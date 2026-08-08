const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, "leetcode_data");
const outputFile = path.join(dataDir, "problems-metadata.json");

try {
  if (!fs.existsSync(dataDir)) {
    console.error("leetcode_data directory does not exist!");
    process.exit(1);
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json") && f !== "problems-metadata.json");
  const problemsList = [];

  for (const file of files) {
    try {
      const fileContent = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      const problemData = JSON.parse(fileContent);
      problemsList.push({
        title: problemData.title || file.replace(".json", ""),
        slug: file.replace(".json", ""),
        difficulty: problemData.difficulty || "Medium",
        constraints: problemData.constraints || []
      });
    } catch (err) {
      console.error(`Error parsing file ${file}:`, err);
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(problemsList, null, 2), 'utf-8');
  console.log(`Successfully generated ${problemsList.length} problem metadata entries at ${outputFile}`);
} catch (err) {
  console.error("Failed to generate problems-metadata.json:", err);
  process.exit(1);
}
