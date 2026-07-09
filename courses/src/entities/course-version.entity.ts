import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';

@Entity('course_versions')
export class CourseVersion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    course_id: string;

    @ManyToOne(() => Course, (course) => course.versions, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'course_id' })
    course: Course;

    @Column()
    version_number: number;

    @Column({ type: 'json' })
    content: Record<string, any>;

    @CreateDateColumn()
    created_at: Date;

    @Column()
    created_by: string;

    @Column({ default: false })
    is_active: boolean;
}