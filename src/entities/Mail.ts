import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity('raw_mails')
export class Mail {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar' })
    address: string;

    @Column({ type: 'varchar' })
    from: string;

    @Column({ type: 'varchar' })
    to: string;

    @Column({ type: 'varchar', nullable: true })
    cc: string;

    @Column({ type: 'text' })
    subject: string;

    @Column({ type: 'text' })
    text_content: string;

    @Column({ type: 'text' })
    html_content: string;

    @Column({ type: 'jsonb', nullable: true })
    attachments: any;

    @Column({ type: 'jsonb', nullable: true })
    headers: any;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;
} 