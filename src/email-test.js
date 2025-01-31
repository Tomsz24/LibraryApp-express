import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "tomaszwojciechowski244@gmail.com",
    pass: "tzqtdzwpnpsxpijw",
  },
});

const testEmail = async () => {
  try {
    await transporter.sendMail({
      from: "Library app <tomaszwojciechowski244@gmail.com>",
      to: "tomaszwojciechowski244@gmail.com",
      subject: "Test email",
      html: `
        <h1>Test email</h1>
        <p>This is a test email from Library app</p>
      `,
    });
    console.log("Email sent");
  } catch (err) {
    console.log("Email", process.env.GMAIL_USER);
    console.log("Password", process.env.GMAIL_PASSWORD);
    console.error("Blad podczas wysylania email", err);
  }
};

(async () => {
  await testEmail();
})();
