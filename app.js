//app.js

const API_URL = "https://robolox-auth.onrender.com";

let accessToken = localStorage.getItem("robolox_access_token");
let enrollmentToken = null;
let loginToken = null;
let userName = null;

async function api(endpoint, options={}, token=null){
    const headers = options.header || {};
    if(options.body && typeof options.body !== "string"){
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(options.body);
    }
    if (token){
        headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(API_URL + endpoint, {...options, headers});
    let data = null;

    try{
        data = await response.json();
    } catch{
        data = null;
    }

    if(!response.ok){
        throw new Error(data?.detail || "Request failed");
    }
    
    return data;
}

function createOtpAuthUri(secret, username){
    const issuer = "Robolox";
    const label = `${issuer}: ${username}`;

    return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

async function register(){
    const username = document.getElementById("registerUsername").value.trim();
    userName = username;
    const password = document.getElementById("registerPassword").value;
    if (!username || !password){
        setMessage("registerMessage", "Username and password are required");
        return;
    }
    try {
        const data = await api(
            endpoint = "/register",
            options = {
                method: "POST",
                body: {
                    username,
                    password
                }
            }
        );
        const secret = data.totp_secret;
        if (!secret){
           throw new Error("Server did not return a TOTP secret");
        }
        document.getElementById("totpSecret").textContent = secret;
        document.getElementById("totpUsername").textContent = username;
        document.getElementById("totpServiceName").textContent = "Robolox";
        enrollmentToken = data.enrollment_token || data.access_token || data.login_token || null;

        const otpAuthUri = createOtpAuthUri(secret, username);
        const qrContainer = document.getElementById("qrcode");
        qrContainer.innerHTML = "";

        new QRCode(
            qrContainer, 
            {
            text: otpAuthUri,
            width: 220,
            height: 220,
            correctLevel: QRCode.CorrectLevel.M
            }
        );

        document.getElementById("registerSection").classList.add("hidden");
        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("enrollmentSection").classList.remove("hidden");

        setMessage("enrollmentMessage", "Add the secret to Google Authenticator");
    } catch(error){
        setMessage("registerMessage", error.message);
    }
}


async function verifyEnrollment(){
    const code = document.getElementById("enrollmentCode").value.trim();
    const username = document.getElementById("loginUsername").value.trim() || userName;
    if (!code) {
        setMessage("enrollmentMessage", "Enter the authenticator code");
        return;
    }

    try{
        const data = await api(
            endpoint = "/verify-totp",
            options = {
                method: "POST",
                body: {
                    username,
                    code
                }
            },
            token = enrollmentToken
        )
        setMessage("enrollmentMessage", "Authenticator verified successfully");

        setTimeout(() => {
            document.getElementById("enrollmentSection").classList.add("hidden");
            document.getElementById("loginSection").classList.remove("hidden");
        }, 1000);
    } catch(error){
        setMessage("enrollmentMessage", error.message);
    }
}

async function login(){
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    if(!username || !password){
        setMessage("loginMessage", "Username and password are required");
        return;
    }

    try{
        const data = await api(
            endpoint = "/login",
            options = {
                method: "POST",
                body: {
                    username: username,
                    password: password
                }
            }
        );
        loginToken = data.login_token || data.access_token;
        console.log(loginToken);
        if(!loginToken){
            throw new Error("Server did not return a login token");
        }

        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("totpLoginSection").classList.remove("hidden");
        setMessage("totpLoginMessage", "Password accepted. Enter your authenticator code.");
    } catch(error){
        setMessage("loginMessage", error.message);
    }
}
async function verifyLoginTotp(){
    const code = document.getElementById("loginTotp").value.trim();
    const username = document.getElementById("loginUsername").value.trim();
    if(!code){
        setMessage("totpLoginMessage", "Enter the TOTP Code");
        return;
    }

    try{
        const data = await api(
            endpoint = "/verify-totp",
            options = {
                method: "POST",
                body: {
                    username,
                    code
                }
            },
            token = loginToken
        );

        accessToken = data.access_token;
        localStorage.setItem("robolox_access_token", accessToken);

        loginToken = null;
        
        document.getElementById("totpLoginSection").classList.add("hidden");
        document.getElementById("dashboardSection").classList.remove("hidden");
        document.getElementById("dashboardMessage").textContent = "Successfully authenticated with password + TOTP";
    } catch(error){
        setMessage("totpLoginMessage", error.message);
    }
}

function logout(){
    accessToken = null;
    loginToken = null;
    enrollmentToken = null;
    localStorage.removeItem("robolox_access_token");

    document.getElementById("dashboardSection").classList.add("hidden");
    document.getElementById("loginSection").classList.remove("hidden");

    document.getElementById("loginPassword").value = "";
    document.getElementById("loginTotp").value = "";
}

function setMessage(elementId, message){
    document.getElementById(elementId).textContent = message;
}
