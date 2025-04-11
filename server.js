// server.js
const jsonServer = require('json-server');
const fs = require('fs');
const path = require('path');

const server = jsonServer.create();
const dbPath = path.join(__dirname, 'db/db.json'); // Adjust to your actual path
const router = jsonServer.router(dbPath);
const middlewares = jsonServer.defaults();

server.use(middlewares);

// Custom route to get raw DB content
server.get('/__raw_db__', (req, res) => {
  const content = fs.readFileSync(dbPath, 'utf8');
  res.send(content);
});

// Custom route to update raw DB content
server.post('/__update_db__', (req, res) => {
  try {
    const content = req.body.content;
    // Validate JSON
    JSON.parse(content);
    fs.writeFileSync(dbPath, content);
    
    // Reload the router with the updated db
    router.db.read();
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

server.use(router);

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`JSON Server is running on port ${PORT}`);
});
