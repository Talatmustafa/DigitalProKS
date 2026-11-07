
const crypto = require("crypto");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question("Create your admin password: ", (password) => {
    if (password.length < 12) {
        console.log("Password must contain at least 12 characters.");
        rl.close();
        return;
    }

    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto.scryptSync(password, salt, 64).toString("hex");

    const sessionSecret = crypto.randomBytes(48).toString("hex");

    console.log("\nAdd these lines to your .env file:\n");
    console.log("ADMIN_PASSWORD_SALT=" + salt);
    console.log("ADMIN_PASSWORD_HASH=" + hash);
    console.log("ADMIN_SESSION_SECRET=" + sessionSecret);

    rl.close();
});
