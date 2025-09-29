import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import camera from "./camera.png";
import mic from "./mic.png";
import "./Core.css";

export default function Core() {
  const navigate = useNavigate();
  const API_URL = "http://localhost:5000";

  const userPhone = localStorage.getItem("userPhone");
  const userKey = `chatMessages_${userPhone || "guest"}`;

  const [messages, setMessages] = useState(() => {
    if (!userPhone) return [];
    const saved = localStorage.getItem(userKey);
    return saved ? JSON.parse(saved) : [];
  });

  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const [pendingAudio, setPendingAudio] = useState(null);
  const [pendingAudioBlob, setPendingAudioBlob] = useState(null);
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (userPhone) localStorage.setItem(userKey, JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, userPhone, userKey]);

  const sendTextToBackend = async (text) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userPhone: userPhone || "guest" }),
      });
      return await res.json();
    } catch (err) {
      console.error("Error contacting backend:", err);
      return { reply_text: "⚠️ Unable to connect to server." };
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && pendingImages.length === 0 && !pendingAudio) return;

    const newMessage = { role: "user" };
    if (input.trim()) newMessage.text = input;
    if (pendingImages.length > 0) newMessage.images = [...pendingImages];
    if (pendingAudio) newMessage.audio = pendingAudio;

    setMessages((prev) => [...prev, newMessage]);

    setInput("");
    const imagesToSend = [...pendingImages];
    setPendingImages([]);
    const audioBlobToSend = pendingAudioBlob;
    setPendingAudio(null);
    setPendingAudioBlob(null);

    // 🖼 Handle image(s)
    if (imagesToSend.length > 0) {
      setMessages((prev) => [...prev, { role: "bot", text: "🖼 Analyzing image(s)..." }]);
      try {
        const formData = new FormData();
        for (let i = 0; i < imagesToSend.length; i++) {
          const blob = await fetch(imagesToSend[i]).then((res) => res.blob());
          formData.append("images", blob, `disease_image_${i}.jpg`);
        }
        if (input.trim()) formData.append("user_query", input.trim());

        const res = await fetch(`${API_URL}/image-disease`, { method: "POST", body: formData });
        const data = await res.json();

        setMessages((prev) => {
          const updated = [...prev];
          updated.pop();
          if (Array.isArray(data.results)) {
            data.results.forEach((item) => {
              updated.push({
                role: "bot",
                text: `🧾 **Predicted Disease:** ${item.predicted_disease}\n\n${item.reply_text}`,
              });
            });
          } else {
            updated.push({
              role: "bot",
              text: `🧾 **Predicted Disease:** ${data.predicted_disease}\n\n${data.reply_text}`,
            });
          }
          return updated;
        });
      } catch (error) {
        console.error("Image disease error:", error);
        setMessages((prev) => {
          const updated = [...prev];
          updated.pop();
          updated.push({ role: "bot", text: "⚠️ Failed to analyze image(s)." });
          return updated;
        });
      }
    }

    // 💬 Handle text
    else if (input.trim()) {
      setMessages((prev) => [...prev, { role: "bot", text: "⏳ Processing..." }]);
      const response = await sendTextToBackend(input);
      setMessages((prev) => {
        const updated = [...prev];
        updated.pop();
        updated.push({ role: "bot", text: response.reply_text || "🤖 No response" });
        return updated;
      });
    }

    // 🎤 Handle voice
    if (audioBlobToSend) {
      const formData = new FormData();
      formData.append("audio", audioBlobToSend, "recording.webm");
      formData.append("userPhone", userPhone || "guest");

      setMessages((prev) => [...prev, { role: "bot", text: "⏳ Processing voice..." }]);

      try {
        const res = await fetch(`${API_URL}/voice`, { method: "POST", body: formData });
        const data = await res.json();

        setMessages((prev) => {
          const updated = [...prev];
          updated.pop();
          updated.push({
            role: "bot",
            text: data.reply_text || data.error || "⚠️ No response from server.",
            // 🔥 Use reply_audio_url instead of base64
            audio: data.reply_audio_url || null,
          });
          return updated;
        });
      } catch (err) {
        console.error("Voice API error:", err);
        setMessages((prev) => {
          const updated = [...prev];
          updated.pop();
          updated.push({ role: "bot", text: "⚠️ Failed to process voice message." });
          return updated;
        });
      }
    }
  };

  const handleDiseaseImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = "";
    const convertToBase64 = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

    const base64Images = await Promise.all(files.map((file) => convertToBase64(file)));
    setPendingImages((prev) => [...prev, ...base64Images]);
  };

  const toggleRecording = async () => {
    if (recording) {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      setRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunks.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunks.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: "audio/webm;codecs=opus" });
          const audioUrl = URL.createObjectURL(audioBlob);
          setPendingAudio(audioUrl);
          setPendingAudioBlob(audioBlob);
        };

        mediaRecorder.start();
        setRecording(true);
      } catch (err) {
        console.error("Mic error:", err);
        alert("Please allow microphone access.");
      }
    }
  };

  const handleClearChat = () => {
    localStorage.removeItem(userKey);
    setMessages([]);
  };

  const handleLogout = () => {
    localStorage.removeItem("userPhone");
    navigate("/login");
  };

  const removeImage = (index) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const cancelAudio = () => {
    setPendingAudio(null);
    setPendingAudioBlob(null);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#ECE5DD" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 20px", background: "linear-gradient(90deg, #dcecd1ff 0%, #aedb94ff 100%)",
        borderBottom: "1px solid #ccc", boxShadow: "0 2px 6px rgba(0,0,0,0.1)", borderRadius: "0 0 10px 10px"
      }}>
        <h3 style={{
          margin: 0, fontSize: "20px", fontWeight: "bold", letterSpacing: "0.5px", color: "#094b20"
        }}>
          Welcome, <span style={{ color: "#054e15" }}>{userPhone || "Guest"}!</span>
        </h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleClearChat} style={{
            fontFamily: "inherit", fontSize: "16px", backgroundColor: "#ffffff", color: "#095624",
            border: "1px solid #095624", borderRadius: "8px", padding: "6px 14px", fontWeight: "bold",
            cursor: "pointer", transition: "all 0.3s ease"
          }}>Clear Chat</button>
          <button className="cssbuttons-io-button" onClick={handleLogout}>
            Logout
            <div className="icon">
              <svg height="24" width="24" viewBox="0 0 24 24">
                <path d="M0 0h24v24H0z" fill="none"></path>
                <path d="M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z"
                  fill="currentColor"></path>
              </svg>
            </div>
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: "8px"
          }}>
            <div style={{
              background: msg.role === "user" ? "#DCF8C6" : "#FFFFFF",
              padding: "10px 14px", borderRadius: "10px", maxWidth: "70%",
              boxShadow: "0px 1px 3px rgba(0,0,0,0.1)", whiteSpace: "pre-line"
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {msg.images && msg.images.map((img, idx) => (
                  <img key={idx} src={img} alt="sent"
                    style={{ maxWidth: "200px", borderRadius: "8px", alignSelf: "flex-start" }} />
                ))}

                {/* ✅ Loader animation for voice */}
                {msg.isLoadingVoice ? (
                  <div className="voice-loader">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                ) : (
                  msg.text && <span style={{ marginTop: "4px", display: "block" }}>{msg.text}</span>
                )}
              </div>

              {msg.audio && (
                <div style={{
                  display: "flex", alignItems: "center", backgroundColor: msg.role === "user" ? "#DCF8C6" : "#F8F8F8",
                  padding: "8px 12px", borderRadius: "25px", marginTop: "5px", boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
                }}>
                  <audio controls src={msg.audio} style={{ width: "100%", minWidth: "180px", maxWidth: "300px" }} />
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Image Preview */}
        {pendingImages.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px", flexWrap: "wrap", gap: "5px" }}>
            {pendingImages.map((img, index) => (
              <div key={index} style={{ position: "relative" }}>
                <img src={img} alt="preview" style={{ maxWidth: "100px", borderRadius: "8px" }} />
                <button onClick={() => removeImage(index)} style={{
                  position: "absolute", top: "0", right: "0", border: "none", borderRadius: "50%", cursor: "pointer",
                  background: "#fc0202ff", width: "18px", height: "18px", lineHeight: "16px"
                }}>❌</button>
              </div>
            ))}
          </div>
        )}

        {/* Audio Preview */}
        {pendingAudio && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
            <div style={{
              background: "#FFF8E7", padding: "8px 12px", borderRadius: "10px", boxShadow: "0px 1px 3px rgba(0,0,0,0.1)",
              maxWidth: "70%", display: "flex", alignItems: "center", gap: "10px"
            }}>
              <audio controls src={pendingAudio} style={{ minWidth: "200px", maxWidth: "300px" }} />
              <button onClick={cancelAudio} style={{
                background: "red", color: "#fff", border: "none", borderRadius: "50%", cursor: "pointer",
                width: "24px", height: "24px"
              }}>✖</button>
            </div>
          </div>
        )}

        <div ref={chatEndRef}></div>
      </div>

      {/* Input Area */}
      <div style={{
        display: "flex", alignItems: "center", padding: "10px",
        background: "#fff", borderTop: "1px solid #ddd"
      }}>
        <label style={{ cursor: "pointer", marginRight: "8px" }}>
          <span style={{
            fontSize: "14px", background: "#e2e8e5ff", padding: "15px 8px", borderRadius: "6px"
          }}>
            <img src={camera} alt="Upload" style={{ width: "28px", height: "28px", filter: "brightness(0.2)" }} />
          </span>
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleDiseaseImageUpload} />
        </label>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !pendingImages.length && !pendingAudio) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message"
          style={{
            flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #ccc", outline: "none"
          }}
        />

        <button onClick={toggleRecording} style={{
          marginLeft: "8px", background: recording ? "#ff4d4d" : "#ddd",
          border: "none", borderRadius: "50%", width: "40px", height: "40px", cursor: "pointer",
          animation: recording ? "pulse 1s infinite" : "none"
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px"
            fill={recording ? "#fff" : "#090909ff"}>
            <path d="M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Z" />
          </svg>
        </button>

        <button onClick={handleSend} style={{
          marginLeft: "8px", background: "#095624ff", color: "#fff", border: "none",
          borderRadius: "50%", width: "40px", height: "40px", cursor: "pointer"
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="35px" fill="#e3e3e3">
            <path d="M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v140l240 60-240 60v140Zm0 0v-400 400Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
