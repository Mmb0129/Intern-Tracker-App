function switchRole(role) {
    document.getElementById("role").value = role;
    
    if (role === "student") {
        document.getElementById("student-login").style.display = "block";
        document.getElementById("coordinator-login").style.display = "none";
        document.getElementById("student-btn").classList.add("active");
        document.getElementById("coordinator-btn").classList.remove("active");
    } else {
        document.getElementById("student-login").style.display = "none";
        document.getElementById("coordinator-login").style.display = "block";
        document.getElementById("student-btn").classList.remove("active");
        document.getElementById("coordinator-btn").classList.add("active");
    }
}
