const { Pool } = require("pg");

// Try different passwords here - UPDATE THE PASSWORD FIELD
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "postgres", // Connect to default database first
  password: "postgres", // 🔑 CHANGE THIS to your actual password
  port: 5432,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ SUCCESS! Connected to PostgreSQL!");
    console.log("Your password is:", "postgres"); // Update this line
    client.release();

    // Now check if we can create the database
    await pool.query("CREATE DATABASE auth_dashboard");
    console.log('✅ Database "auth_dashboard" created successfully!');
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to connect:", err.message);
    console.log("\n📌 Common passwords to try:");
    console.log("   - postgres");
    console.log("   - admin");
    console.log("   - password");
    console.log("   - (blank - empty string)");
    console.log("   - root");
    console.log(
      "\n💡 If none work, you may need to reset your PostgreSQL password",
    );
    process.exit(1);
  }
}

testConnection();
