const schedule = require('node-schedule');
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "returnright.info@gmail.com",
    pass: "rqup ggrr zcmg bqjh",
  },
});
async function sendEmail(to, subject, text) {
  try {
    await transporter.sendMail({
      from: 'returnright.info@gmail.com', // Use your email here
      to,
      subject,
      text,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}

// Schedule reminders for each teammate
function scheduleReminders(event, teammates) {
  const eventDate = new Date(event.date);

  // Schedule for each teammate's email
  teammates.forEach(teammate => {
    const studentEmail = teammate.email;

    // 1 day before
    const oneDayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    if (oneDayBefore > new Date()) {
      schedule.scheduleJob(oneDayBefore, () => {
        sendEmail(studentEmail, `Reminder: ${event.eventname} in 1 Day`, `Don't forget about the event!`);
      });
    }

    // 1 hour before
    const oneHourBefore = new Date(eventDate.getTime() - 60 * 60 * 1000);
    if (oneHourBefore > new Date()) {
      schedule.scheduleJob(oneHourBefore, () => {
        sendEmail(studentEmail, `Reminder: ${event.eventname} in 1 Hour`, `The event is starting soon!`);
      });
    }

    // 10 minutes before
    const tenMinutesBefore = new Date(eventDate.getTime() - 10 * 60 * 1000);
    if (tenMinutesBefore > new Date()) {
      schedule.scheduleJob(tenMinutesBefore, () => {
        sendEmail(studentEmail, `Reminder: ${event.eventname} in 10 Minutes`, `Get ready! The event is about to start.`);
      });
    }
  });
}
module.exports = { scheduleReminders };
