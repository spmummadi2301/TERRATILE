const path = require("path");
const express = require("express");

const PORT = process.env.PORT || 5173;
const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Static server running on http://localhost:${PORT}`);
});
