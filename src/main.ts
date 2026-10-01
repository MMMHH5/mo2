import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { getFrontendUrl } from './common/frontend-url';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { bodyParserErrorHandler } from './common/body-parser-error.middleware';

function validateEnvVars() {
    const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = requiredVars.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`\nCRITICAL ERROR: Missing required environment variables: ${missing.join(', ')}`);
        console.error('Server cannot start. Please verify your .env.production file.\n');
        process.exit(1);
    }

    // Reject Docker build-time placeholder that correctly "exists" but points to nothing.
    let dbHost = '';
    try {
        dbHost = new URL(process.env.DATABASE_URL!).hostname;
    } catch {
        dbHost = '';
    }
    const isPlaceholder = !dbHost || dbHost === 'localhost' || dbHost === '127.0.0.1';
    if (isPlaceholder) {
        console.error('\nCRITICAL ERROR: DATABASE_URL does not point to a real database server.');
        console.error(`Resolved host: '${dbHost || '(unparseable)'}'.`);
        console.error('On Railway: open the backend service > Variables, make sure DATABASE_URL is a REFERENCE to the Postgres service (value like ${{Postgres.DATABASE_URL}}), then redeploy.\n');
        process.exit(1);
    }

    // Enforce minimum JWT_SECRET length to prevent weak signing keys
    const jwtSecret = process.env.JWT_SECRET!;
    if (jwtSecret.length < 32) {
        console.error('\nCRITICAL ERROR: JWT_SECRET must be at least 32 characters long.');
        console.error('Current length: ' + jwtSecret.length);
        console.error('Generate a strong secret: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
        process.exit(1);
    }
}

async function bootstrap() {
    validateEnvVars();
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Railway terminates TLS and forwards every request from its own edge, so
    // without this `req.ip` is the proxy's address and every visitor on earth
    // shares one identity. Two things depend on that value:
    //
    //   - ThrottlerGuard tracks by req.ip, so the 300 req/min limit was applied
    //     to the edge as a whole instead of to each caller.
    //   - Express logs it as the client, which made every access log useless.
    //
    // `1` trusts exactly one hop (Railway) and takes the next entry in
    // X-Forwarded-For as the client. It is NOT `true`: that would let a client
    // send its own X-Forwarded-For and spoof its identity, which here would let
    // anyone bypass the rate limit and forge the audit trail.
    app.set('trust proxy', 1);

    // Security headers via Helmet
    app.use(helmet({
        contentSecurityPolicy: false, // Disabled for now; enable after auditing all inline scripts/styles
        crossOriginEmbedderPolicy: false, // Allow embedding resources
    }));

    // Block PUBLIC access to private upload areas. Receipts, CVs and anything
    // under uploads/private/* must only be reachable through the authenticated
    // download endpoints (enrollments/:id/receipt, instructor-applications/:id/cv).
    app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
        const p = req.path || '';
        if (
            p === '/receipts' || p.startsWith('/receipts/') ||
            p === '/cvs' || p.startsWith('/cvs/') ||
            p === '/private' || p.startsWith('/private/')
        ) {
            res.status(404).send({ statusCode: 404, message: 'Not Found' });
            return;
        }
        next();
    });

    // Serve static files from the uploads directory.
    // NOTE: receipts & CVs are blocked above and stored under uploads/private/*;
    // course media and chat attachments remain publicly embeddable.
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
        prefix: '/uploads',
        setHeaders: (res, filePath) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'private, no-store');
            // Allow the frontend origin to embed uploaded media (helmet defaults CORP to same-origin)
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            // Only preview-safe media types render inline; everything else downloads
            // so an uploaded file can never be interpreted as HTML/SVG active content.
            const inline = /\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i.test(filePath);
            if (!inline) {
                const name = (filePath.split(/[\\/]/).pop() || 'file').replace(/["\\\r\n]/g, '');
                res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
            }
        },
    });

// Increase payload limits for normal json bodies as well if needed (optional)
    app.use(express.json({
      limit: '10mb',
      verify: (req: any, res: any, buf: Buffer) => {
        // Preserve the raw body for signature verification (Stripe webhook)
        if (req.originalUrl.startsWith('/webhooks/stripe')) {
          req.rawBody = buf;
        }
      },
    }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));

    // Must sit directly after the parsers. Express only reaches an error
    // middleware when something above it failed, so this is the only place that
    // can still tell "the body was unparseable" apart from "the app said no" --
    // and it stops V8's parser text from reaching a caller.
    app.use(bodyParserErrorHandler);

    // Set up global ValidationPipe for DTOs
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true, // Automatically transform payloads to be objects typed according to their DTO classes
    }));

    // Every uncaught error is shaped here, so library internals (V8's JSON
    // parser text, body-parser's 413 wording, multer's disk errors) never reach
    // an anonymous caller. Deliberate HttpExceptions keep their message --
    // including validation arrays the frontend depends on -- and 500s get a
    // request id instead of a stack trace.
    app.useGlobalFilters(new AllExceptionsFilter());

    // Setup Swagger Documentation — only in non-production
    if (process.env.NODE_ENV !== 'production') {
        const config = new DocumentBuilder()
            .setTitle('Laxalab API')
            .setDescription('The core API documentation for the Laxalab learning and certification platform.')
            .setVersion('1.0')
            .addBearerAuth(
                {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    name: 'JWT',
                    description: 'Enter JWT token',
                    in: 'header',
                },
                'JWT-auth', // This name is used to match @ApiBearerAuth()
            )
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('api/docs', app, document);
    }

    // Strict CORS Configuration
    app.enableCors({
        origin: getFrontendUrl(),
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
        allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    await app.listen(process.env.PORT || 3001);
}
bootstrap();
