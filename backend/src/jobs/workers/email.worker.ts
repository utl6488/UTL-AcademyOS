import { Worker } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { type Transporter } from 'nodemailer';

import { logger } from '@/common/logger.js';
import { env } from '@/config/env.js';
import { getRedis } from '@/db/redis.js';
import type { EmailJobData } from '@/jobs/email.queue.js';
import { QueueName } from '@/jobs/queues.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });
  return transporter;
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    QueueName.EMAIL,
    async (job) => {
      const { to, subject, text, html } = job.data;
      const info = await getTransporter().sendMail({
        from: env.SMTP_FROM,
        to,
        subject,
        text,
        html,
      });
      logger.info({ to, subject, messageId: info.messageId }, 'email sent');
    },
    { connection: getRedis(), concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, to: job?.data.to }, 'email job failed');
  });

  return worker;
}
