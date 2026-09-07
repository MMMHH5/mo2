import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import helmet from 'helmet';

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

    // Security headers via Helmet
    app.use(helmet({
        contentSecurityPolicy: false, // Disabled for now; enable after auditing all inline scripts/styles
        crossOriginEmbedderPolicy: false, // Allow embedding resources
    }));

    // Serve static files from the uploads directory
    // Note: This is kept for backward compatibility with existing upload references.
    // For new files, prefer the authenticated proxy at GET /uploads/* (see health.controller.ts).
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
        prefix: '/uploads',
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

    // Set up global ValidationPipe for DTOs
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true, // Automatically transform payloads to be objects typed according to their DTO classes
    }));

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
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
        allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    await app.listen(process.env.PORT || 3001);
}
bootstrap();
