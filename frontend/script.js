document.addEventListener("DOMContentLoaded", function () {
    const authPopup = document.getElementById("auth-popup");
    const authForm = document.getElementById("auth-form");
    const switchAuth = document.getElementById("switch-auth");
    const authTitle = document.getElementById("auth-title");
    const switchText = document.getElementById("switch-text");
    const closePopup = document.getElementById("close-popup");
    const logoutBtn = document.getElementById("logout-btn");
    const profileUsername = document.getElementById("profile-username");
    const creditsDisplay = document.getElementById("user-credits");
    const profileMessage = document.getElementById("profile-message");
    const profileLink = document.getElementById("profile-link");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    let isLogin = true;

    // ✅ Function to check login status
    function checkLoginStatus() {
        const username = localStorage.getItem("username");
        const role = localStorage.getItem("role");
        const credits = localStorage.getItem("credits");

        if (username && role) {
            if (profileUsername) profileUsername.textContent = `Hi, ${username}`;
            
            if (window.location.pathname.includes("profile.html")) {
                fetchCredits(username);
            }
        } else {
            // 🚨 Show message & restrict access if not registered
            if (window.location.pathname.includes("profile.html")) {
                alert("You need to register first!");
                if (profileMessage) profileMessage.textContent = "You need to register first to access this extraordinary tool!";
            }
        }
    }

    // ✅ When clicking "Profile" in header, check login status
    if (profileLink) {
        profileLink.addEventListener("click", function (event) {
            const username = localStorage.getItem("username");
            if (!username) {
                event.preventDefault();
                alert("You must log in first!");
                authPopup.style.display = "flex";
            }
        });
    }

    checkLoginStatus(); // Run on page load

    // ✅ Toggle Between Login & Register
    if (switchAuth) {
        switchAuth.addEventListener("click", function (event) {
            event.preventDefault();
            isLogin = !isLogin;
            authTitle.textContent = isLogin ? "Login or Register" : "Create an Account";
            switchText.innerHTML = isLogin ? 
                "Don't have an account? <a href='#' id='switch-auth'>Register</a>" :
                "Already have an account? <a href='#' id='switch-auth'>Login</a>";
        });
    }

    // ✅ Handle Login
    if (loginForm) {
        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const username = document.getElementById("login-username").value.trim();
            const password = document.getElementById("login-password").value.trim();

            let response = await fetch(`http://127.0.0.1:8080/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            let data = await response.json();

            if (response.ok) {
                alert("Login successful!");
                localStorage.setItem("username", username);
                localStorage.setItem("role", data.role);
                localStorage.setItem("credits", data.credits || 0);

                if (data.role === "admin") {
                    window.location.href = "admin.html";
                } else {
                    window.location.href = "profile.html";
                }
            } else {
                alert("Invalid login credentials. Please try again.");
            }
        });
    }

    // ✅ Handle Registration
    if (registerForm) {
        registerForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const username = document.getElementById("reg-username").value.trim();
            const password = document.getElementById("reg-password").value.trim();

            let response = await fetch(`http://127.0.0.1:8080/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            let data = await response.json();

            if (response.ok) {
                alert("Registration successful! Redirecting to login...");
                window.location.href = "login.html";
            } else {
                alert("Username already exists. Please try a different one.");
            }
        });
    }

    // ✅ Close Button (X) (Closes popup but does not reopen it automatically)
    if (closePopup) {
        closePopup.addEventListener("click", function () {
            authPopup.style.display = "none";
        });
    }

    // ✅ Logout Function
    function logoutUser() {
        localStorage.clear();
        alert("You have been logged out.");
        window.location.href = "index.html";
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", logoutUser);
    }

    // ✅ Fetch User Credits
    function fetchCredits(username) {
        fetch(`http://127.0.0.1:8080/auth/profile?username=${username}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to fetch credits");
                }
                return response.json();
            })
            .then(data => {
                if (data.credits !== undefined) {
                    document.getElementById("user-credits").textContent = data.credits;
                    localStorage.setItem("credits", data.credits);
                } else {
                    document.getElementById("user-credits").textContent = "N/A";
                }
            })
            .catch(error => {
                console.error("Error fetching credits:", error);
                document.getElementById("user-credits").textContent = "N/A";
            });
    }
    
    // ✅ Show Upload Document Section
function showUpload() {
    document.getElementById("content-area").innerHTML = `
        <div class="upload-container">
            <h3>Upload Document</h3>
            <input type="file" id="document-upload">
            <button onclick="uploadDocument()">Upload</button>
        </div>
    `;
}

// ✅ Show Previous Scans
function showPreviousScans() {
    fetch("http://127.0.0.1:8080/user/scan-history?username=" + localStorage.getItem("username"))
        .then(response => response.json())
        .then(data => {
            let content = "<div class='previous-scans-container'><h3>Previous Scans</h3>";
            if (data.scans.length > 0) {
                content += "<ul>";
                data.scans.forEach(scan => {
                    content += `<li>${scan.file_name} - ${scan.timestamp} <button onclick="downloadHistory('${scan.file_path}')">Download</button></li>`;
                });
                content += "</ul>";
            } else {
                content += "<p>No previous scans found.</p>";
            }
            content += "</div>";
            document.getElementById("content-area").innerHTML = content;
        });
}

// ✅ Show Requests Section
function showRequests() {
    document.getElementById("content-area").innerHTML = `
        <div class="request-container">
            <h3>Request Additional Credits</h3>
            <button onclick="sendCreditRequest()">Request 1 Credit</button>
            <p id="request-status"></p>
        </div>
    `;
}

// ✅ Handle Upload Document
function uploadDocument() {
    let fileInput = document.getElementById("document-upload");
    if (fileInput.files.length === 0) {
        alert("Please select a file.");
        return;
    }
    
    let formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("username", localStorage.getItem("username"));

    fetch("http://127.0.0.1:8080/scan/upload", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => alert(data.message))
    .catch(error => console.error("Upload failed:", error));
}

// ✅ Request Additional Credit
function sendCreditRequest() {
    fetch("http://127.0.0.1:8080/credits/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: localStorage.getItem("username") })
    })
    .then(response => response.json())
    .then(data => document.getElementById("request-status").innerText = data.message)
    .catch(error => console.error("Request failed:", error));
}



// ✅ Download History
function downloadHistory(filePath) {
    window.location.href = "http://127.0.0.1:8080/download?file=" + filePath;
}

});


// ✅ Show Upload Document Section
function showUpload() {
    document.getElementById("content-area").innerHTML = `
        <div class="upload-container">
            <h3>Upload Document</h3>
            <input type="file" id="document-upload">
            <button onclick="uploadDocument()">Upload</button>
        </div>
    `;
}

// ✅ Show Previous Scans
function showPreviousScans() {
    fetch("http://127.0.0.1:8080/user/scan-history?username=" + localStorage.getItem("username"))
        .then(response => response.json())
        .then(data => {
            let content = "<div class='previous-scans-container'><h3>Previous Scans</h3>";
            if (data.scans.length > 0) {
                content += "<ul>";
                data.scans.forEach(scan => {
                    content += `<li>${scan.file_name} - ${scan.timestamp} <button onclick="downloadHistory('${scan.file_path}')">Download</button></li>`;
                });
                content += "</ul>";
            } else {
                content += "<p>No previous scans found.</p>";
            }
            content += "</div>";
            document.getElementById("content-area").innerHTML = content;
        });
}

// ✅ Show Requests Section
function showRequests() {
    document.getElementById("content-area").innerHTML = `
        <div class="request-container">
            <h3>Request Additional Credits</h3>
            <button onclick="sendCreditRequest()">Request 1 Credit</button>
            <p id="request-status"></p>
        </div>
    `;
}

function uploadDocument() {
    let fileInput = document.getElementById("document-upload");
    if (fileInput.files.length === 0) {
        alert("❌ Please select a file.");
        return;
    }

    let formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("username", localStorage.getItem("username"));

    fetch("http://127.0.0.1:8080/upload", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log("✅ Server response:", data); // Debugging

        if (data.message === "File uploaded successfully!") {
            document.getElementById("content-area").innerHTML = `
                <h3>✅ Document Analysis Completed!</h3>
                <p><strong>📄 Summary:</strong> ${data.analysis.summary}</p>
                <p><strong>🔑 Key Topics:</strong> ${data.analysis.topics}</p>
                <p><strong>📝 Word Count:</strong> ${data.analysis.word_count}</p>
                <p><strong>🔍 Match Percentage:</strong> ${data.match_percentage}%</p>
            `;
            alert("✅ File uploaded and analyzed successfully!");
        } else {
            alert("❌ Error uploading file: " + data.message);
        }
    })
    .catch(error => {
        console.error("❌ Upload failed:", error);
        alert("❌ Upload failed. Check console for details.");
    });
}


// ✅ Request Additional Credit
function sendCreditRequest() {
    fetch("http://127.0.0.1:8080/credits/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: localStorage.getItem("username") })
    })
    .then(response => response.json())
    .then(data => document.getElementById("request-status").innerText = data.message)
    .catch(error => console.error("Request failed:", error));
}

// ✅ Download History
function downloadHistory(filePath) {
    window.location.href = "http://127.0.0.1:8080/download?file=" + filePath;
}

// ✅ Ensure Home Loads on Page Load
document.addEventListener("DOMContentLoaded", function () {
    showHome();
});
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("logout-btn").addEventListener("click", function () {
        localStorage.clear();
        alert("Logged out successfully!");
        window.location.href = "index.html";
    });
});

function showUsers() {
    fetch("http://127.0.0.1:8080/admin/users")
        .then(response => response.json())
        .then(users => {
            let content = "<h3>All Users & Remaining Credits</h3><table><tr><th>Username</th><th>Credits</th></tr>";
            users.forEach(user => {
                content += `<tr><td>${user.username}</td><td>${user.credits}</td></tr>`;
            });
            content += "</table>";
            document.getElementById("content-area").innerHTML = content;
        });
}

function showCreditRequests() {
    fetch("http://127.0.0.1:8080/admin/credit-requests")
        .then(response => response.json())
        .then(requests => {
            let content = "<h3>Credit Requests</h3><table><tr><th>Username</th><th>Status</th><th>Action</th></tr>";
            requests.forEach(req => {
                content += `<tr>
                    <td>${req.username}</td>
                    <td>${req.status}</td>
                    <td>
                        <button class="approve-btn" onclick="approveRequest(${req.id})">Approve</button>
                    </td>
                </tr>`;
            });
            content += "</table>";
            document.getElementById("content-area").innerHTML = content;
        });
}

function approveRequest(requestId) {
    fetch("http://127.0.0.1:8080/admin/approve-credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId })
    }).then(response => response.json())
      .then(data => {
          alert(data.message);
          showCreditRequests();
      });
}

function showDocumentStats() {
    fetch("http://127.0.0.1:8080/admin/document-stats")
        .then(response => response.json())
        .then(stats => {
            let content = "<h3>Most Scanned Document Topics</h3><ul>";
            stats.forEach(stat => {
                content += `<li>${stat.topic} - ${stat.count} scans</li>`;
            });
            content += "</ul>";
            document.getElementById("content-area").innerHTML = content;
        });
}
