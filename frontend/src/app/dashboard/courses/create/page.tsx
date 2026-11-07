import ProtectedRoute from '@/components/ProtectedRoute';
import CourseCreateWorkspace from '@/components/CourseCreateWorkspace';

export default function CreateCoursePage() {
    return (
        <ProtectedRoute allowedRoles={['ADMIN', 'COURSE_MANAGER']}>
            <CourseCreateWorkspace />
        </ProtectedRoute>
    );
}