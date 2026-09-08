/**
 * Email utilities and templates for FMC Board Review App.
 *
 * Optimized for Google Workspace (G-Suite) environments with seamless
 * fallback to standard mailto links.
 */

export interface EmailComposeOptions {
  to?: string | string[];
  bcc?: string | string[];
  cc?: string | string[];
  subject: string;
  body: string;
  preferGmail?: boolean;
}

/**
 * Opens a pre-filled email draft.
 * In G-Suite environments, directly opens a Gmail Web Compose tab with
 * recipients, subject, and body pre-populated.
 */
export function openEmailCompose({
  to,
  bcc,
  cc,
  subject,
  body,
  preferGmail = true,
}: EmailComposeOptions): void {
  const toStr = Array.isArray(to) ? to.filter(Boolean).join(',') : (to || '');
  const bccStr = Array.isArray(bcc) ? bcc.filter(Boolean).join(',') : (bcc || '');
  const ccStr = Array.isArray(cc) ? cc.filter(Boolean).join(',') : (cc || '');

  if (preferGmail && typeof window !== 'undefined') {
    const queryParts: string[] = ['view=cm', 'fs=1'];
    if (toStr) queryParts.push(`to=${encodeURIComponent(toStr)}`);
    if (bccStr) queryParts.push(`bcc=${encodeURIComponent(bccStr)}`);
    if (ccStr) queryParts.push(`cc=${encodeURIComponent(ccStr)}`);
    queryParts.push(`su=${encodeURIComponent(subject)}`);
    queryParts.push(`body=${encodeURIComponent(body)}`);

    const gmailUrl = `https://mail.google.com/mail/?${queryParts.join('&')}`;
    const win = window.open(gmailUrl, '_blank');
    if (win) return;
  }

  // Fallback to mailto:
  const queryParts: string[] = [];
  if (bccStr) queryParts.push(`bcc=${encodeURIComponent(bccStr)}`);
  if (ccStr) queryParts.push(`cc=${encodeURIComponent(ccStr)}`);
  queryParts.push(`subject=${encodeURIComponent(subject)}`);
  queryParts.push(`body=${encodeURIComponent(body)}`);

  const mailtoUrl = `mailto:${encodeURIComponent(toStr)}?${queryParts.join('&')}`;
  window.location.href = mailtoUrl;
}

/**
 * Generates an email for a faculty advisor to check in with an individual advisee.
 */
export function generateIndividualAdviseeEmail({
  name,
  surname,
  email,
  curriculumAvg,
  curriculumAttempts,
  onTimePct,
  overdueCount,
  riskReasons,
  weakCategories,
  advisorName,
  appUrl,
}: {
  name: string;
  surname?: string;
  email: string;
  curriculumAvg: number;
  curriculumAttempts: number;
  onTimePct: number;
  overdueCount: number;
  riskReasons: string[];
  weakCategories: Array<{ category: string; percentage: number }>;
  advisorName?: string;
  appUrl?: string;
}): { to: string; subject: string; body: string } {
  const firstName = name.split(' ')[0] || 'Doctor';
  const url = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://brq.stvfamilymed.org');
  const subject = `FMC Board Review: Progress Check-in for Dr. ${surname || firstName}`;

  let body = `Hi Dr. ${firstName},\r\n\r\n`;
  body += `I wanted to reach out with a quick check-in on your board preparation progress in the FMC Board Review App.\r\n\r\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n`;
  body += `📊 YOUR PROGRESS SUMMARY\r\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n`;
  body += `• Core Curriculum Average: ${curriculumAvg.toFixed(1)}% (${curriculumAttempts} blocks completed)\r\n`;
  body += `• On-Time Completion Rate: ${onTimePct.toFixed(0)}%\r\n`;

  if (overdueCount > 0) {
    body += `• Overdue Blocks: ⚠️ ${overdueCount} (Please complete as soon as possible)\r\n`;
  }

  if (riskReasons.length > 0) {
    body += `• Notes / Flags: ${riskReasons.join(' | ')}\r\n`;
  }

  if (weakCategories.length > 0) {
    const topWeak = weakCategories
      .slice(0, 2)
      .map((w) => `${w.category} (${w.percentage.toFixed(0)}%)`)
      .join(', ');
    body += `• High-Yield Areas for Review: ${topWeak}\r\n`;
  }

  body += `\r\nLog in to practice questions and review full explanations:\r\n${url}\r\n\r\n`;
  body += `Please feel free to reach out if you would like to set up a time to review any questions together or discuss your study plan.\r\n\r\n`;
  body += `Best regards,\r\n`;
  body += `${advisorName ? `Dr. ${advisorName}` : 'Faculty Advisor'}\r\n`;

  return { to: email, subject, body };
}

/**
 * Generates an email for an advisor to bulk-email all their advisees with a progress update.
 */
export function generateAllAdviseesEmail({
  advisees,
  advisorName,
  appUrl,
}: {
  advisees: Array<{
    name: string;
    pgy: string;
    email: string;
    curriculumAvg: number;
    curriculumAttempts: number;
    onTimePct: number;
    isAtRisk: boolean;
    isAttention: boolean;
    riskReasons: string[];
    weakCategories: Array<{ category: string; percentage: number }>;
  }>;
  advisorName?: string;
  appUrl?: string;
}): { bcc: string[]; subject: string; body: string } {
  const url = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://brq.stvfamilymed.org');
  const bcc = advisees.map((a) => a.email).filter(Boolean);
  const subject = `FMC Board Review App: Faculty Advisee Update`;

  let body = `Hello Everyone,\r\n\r\n`;
  body += `Here is a summary of your recent progress in the FMC Board Review App:\r\n\r\n`;

  advisees.forEach((a) => {
    const status = a.isAtRisk ? '🚨 AT RISK' : a.isAttention ? '⚠️ NEEDS ATTENTION' : '✅ ON TRACK';
    body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n`;
    body += `👤 ${a.name} (${a.pgy})\r\n`;
    body += `   Status: ${status}\r\n`;
    body += `   Core Curriculum Avg: ${a.curriculumAvg.toFixed(1)}% (${a.curriculumAttempts} blocks completed)\r\n`;
    body += `   On-Time Rate: ${a.onTimePct.toFixed(0)}%\r\n`;
    if (a.riskReasons.length > 0) {
      body += `   Flags: ${a.riskReasons.join(' | ')}\r\n`;
    }
    if (a.weakCategories.length > 0) {
      const topWeak = a.weakCategories
        .slice(0, 2)
        .map((w) => `${w.category} (${w.percentage.toFixed(0)}%)`)
        .join(', ');
      body += `   Areas for Review: ${topWeak}\r\n`;
    }
    body += `\r\n`;
  });

  body += `Log in to complete scheduled blocks, practice questions, and review explanations:\r\n${url}\r\n\r\n`;
  body += `Keep up the great work, and don't hesitate to reach out if you have any questions!\r\n\r\n`;
  body += `Best regards,\r\n`;
  body += `${advisorName ? `Dr. ${advisorName}` : 'Faculty Advisor'}\r\n`;

  return { bcc, subject, body };
}

/**
 * Generates an email reminder for residents who have not yet completed a block.
 */
export function generateBlockReminderEmail({
  blockTitle,
  dueDateStr,
  emails,
  appUrl,
  senderName,
}: {
  blockTitle: string;
  dueDateStr?: string;
  emails: string[];
  appUrl?: string;
  senderName?: string;
}): { bcc: string[]; subject: string; body: string } {
  const url = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://brq.stvfamilymed.org');
  const subject = `[Action Required] FMC Board Review: "${blockTitle}" is due ${dueDateStr || 'this Sunday'}!`;

  let body = `Hi Everyone,\r\n\r\n`;
  body += `This is a friendly reminder that the current Board Review block, "${blockTitle}", is scheduled to close on ${dueDateStr || 'this coming Sunday at 11:59 PM'}.\r\n\r\n`;
  body += `Please log in to complete the block to earn on-time academic points and keep your streak going:\r\n`;
  body += `${url}\r\n\r\n`;
  body += `If you have already started the block, your progress has been auto-saved—you can resume right from your dashboard.\r\n\r\n`;
  body += `Thank you,\r\n`;
  body += `${senderName || 'FMC Board Review Team'}\r\n`;

  return { bcc: emails.filter(Boolean), subject, body };
}
