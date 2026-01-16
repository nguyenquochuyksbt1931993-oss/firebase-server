const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const serviceAccount = require("./serviceAccountKey.json");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).send("Thiếu token");

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // decoded.uid có sẵn
    next();
  } catch (err) {
    return res.status(401).send("Token không hợp lệ");
  }
}

// test server
app.get("/", (req, res) => {
  res.send("Backend is running");
});

// thêm todo
app.post("/todo", requireAuth, async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).send("Thiếu title");

  const uid = req.user.uid;

  await db.collection("todos").add({
    title,
    done: false,
    uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  res.send("Đã lưu to-do");
});


// lấy danh sách
app.get("/todos", requireAuth, async (req, res) => {
  const uid = req.user.uid;

  const snapshot = await db
    .collection("todos")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .get();

  const todos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  res.json(todos);
});

// đổi trạng thái done
app.patch("/todo/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { done } = req.body;

  const ref = db.collection("todos").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).send("Không tìm thấy todo");

  if (doc.data().uid !== req.user.uid) {
    return res.status(403).send("Không có quyền");
  }

  await ref.update({ done: !!done });
  res.send("Đã cập nhật");
});

// xóa todo
app.delete("/todo/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  const ref = db.collection("todos").doc(id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).send("Không tìm thấy todo");

  if (doc.data().uid !== req.user.uid) {
    return res.status(403).send("Không có quyền");
  }

  await ref.delete();
  res.send("Đã xóa");
});

// chạy server
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server chạy tại port ${PORT}`);
});
