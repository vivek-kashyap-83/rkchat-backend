const userData = {
  username: "vivekkashyap",
  password: "vivek",
  displayName: "Vivek",
  adminSecret: "vivekbhai123" 
};

fetch('http://localhost:5000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(userData)
})
.then(response => response.json())
.then(data => console.log("🎉 रिज़ल्ट:", data))
.catch(error => console.log("❌ एरर:", error));