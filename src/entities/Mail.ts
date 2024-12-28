import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity('raw_mails')
export class Mail {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    address: string;

    @Column()
    from: string;

    @Column()
    to: string;

    @Column({ nullable: true })
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

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
} 