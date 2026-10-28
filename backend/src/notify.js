'use strict';
const { SNSClient, PublishCommand, SubscribeCommand } = require('@aws-sdk/client-sns');

const sns = new SNSClient({});
const ADMIN_TOPIC_ARN = process.env.ADMIN_TOPIC_ARN;
const STUDENT_TOPIC_ARN = process.env.STUDENT_TOPIC_ARN;

// SNS subjects: ASCII, single line, max 100 chars.
const subject = (s) => s.replace(/[^\x20-\x7E]/g, '').slice(0, 100);

// Notifications must never break the main request, so every call is wrapped.
async function safe(label, fn) {
  try { await fn(); } catch (e) { console.error(`SNS ${label} failed:`, e.message); }
}

function notifyAdminNewComplaint(c) {
  return safe('admin publish', () => sns.send(new PublishCommand({
    TopicArn: ADMIN_TOPIC_ARN,
    Subject: subject(`New complaint: ${c.title}`),
    Message:
`A new complaint was submitted.

ID:        ${c.complaintId}
Title:     ${c.title}
Category:  ${c.category}
Priority:  ${c.priority}
Location:  ${c.location || '-'}
Student:   ${c.userName} <${c.userEmail}>

${c.description}`,
  })));
}

// One topic, many students: each student's email gets its own subscription with a filter policy
// so they only receive messages addressed to them. (SNS asks them to confirm the first time.)
function subscribeStudent(email) {
  return safe('student subscribe', () => sns.send(new SubscribeCommand({
    TopicArn: STUDENT_TOPIC_ARN,
    Protocol: 'email',
    Endpoint: email,
    Attributes: { FilterPolicy: JSON.stringify({ recipient: [email] }) },
    ReturnSubscriptionArn: true,
  })));
}

function notifyStudentUpdate(c) {
  return safe('student publish', () => sns.send(new PublishCommand({
    TopicArn: STUDENT_TOPIC_ARN,
    Subject: subject(`Complaint update: ${c.title} is now ${c.status}`),
    Message:
`Hello ${c.userName},

Your complaint has been updated.

ID:      ${c.complaintId}
Title:   ${c.title}
Status:  ${c.status}
Remark:  ${c.adminRemark || '-'}

Log in to the Campus Complaint Portal to see the full history.`,
    MessageAttributes: { recipient: { DataType: 'String', StringValue: c.userEmail } },
  })));
}

module.exports = { notifyAdminNewComplaint, subscribeStudent, notifyStudentUpdate };
