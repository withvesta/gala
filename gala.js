/**
 * KUPSAgala 2026 - Main Application Controller
 */

// Application State
let currentView = 'register';
let isAdminAuthenticated = false;
let allAttendees = [];
let lotteryCodes = []; // Array of { code, name, year }
let isSpinning = false;

// DOM Load Initialization
document.addEventListener("DOMContentLoaded", () => {
    // Connect to the DB and listen for updates
    window.galaDb.subscribe(data => {
        allAttendees = data;
        updateAdminStats();
        updateAttendeeTable();
        rebuildLotteryReel();
    });

    // Setup registration number auto-formatter and validation listener
    const regNoInput = document.getElementById("reg-no");
    if (regNoInput) {
        regNoInput.addEventListener("input", handleRegNoInput);
    }

    // Setup scroll listener on the lottery reel to dynamically highlight the center item
    const reel = document.getElementById("lottery-reel");
    if (reel) {
        reel.addEventListener("scroll", debounce(highlightCenterItem, 15));
    }
});

// ================= VIEW SWITCHER =================
function switchView(viewId) {
    // Guard admin dashboard access
    if (viewId === 'admin-dashboard' && !isAdminAuthenticated) {
        viewId = 'admin-login';
    }

    // Deactivate current view
    const currentSection = document.getElementById(`view-${currentView}`);
    const currentNavBtn = document.getElementById(`nav-btn-${currentView === 'admin-dashboard' ? 'admin' : currentView}`);
    
    if (currentSection) {
        currentSection.classList.remove('active');
        // Let transition finish before hiding
        setTimeout(() => {
            currentSection.style.display = 'none';
        }, 150);
    }
    if (currentNavBtn) {
        currentNavBtn.classList.remove('active');
    }

    // Activate new view
    const newSection = document.getElementById(`view-${viewId}`);
    // Sync nav button highlighting
    let navBtnId = `nav-btn-${viewId}`;
    if (viewId === 'admin-login' || viewId === 'admin-dashboard') {
        navBtnId = 'nav-btn-admin';
    }
    const newNavBtn = document.getElementById(navBtnId);

    if (newSection) {
        setTimeout(() => {
            newSection.style.display = 'block';
            // Trigger browser reflow for entry animation
            newSection.offsetHeight;
            newSection.classList.add('active');
        }, 160);
    }
    if (newNavBtn) {
        newNavBtn.classList.add('active');
    }

    currentView = viewId;
    
    // Clear login errors when shifting
    if (viewId !== 'admin-login') {
        const feedback = document.getElementById("login-feedback");
        if (feedback) feedback.textContent = "";
        const passwordInput = document.getElementById("admin-password");
        if (passwordInput) passwordInput.value = "";
    }
}

// ================= REGISTRATION NUMBER FORMATTER & VALIDATION =================
function handleRegNoInput(e) {
    let input = e.target.value.toUpperCase();
    
    // Remove characters that shouldn't be in registration numbers
    // Accept letters, digits, and slashes
    input = input.replace(/[^A-Z0-9\/]/g, "");
    
    // Auto-formatting helper: automatically insert slashes if the user types without them
    // Format target: PHAM/M/XXXX/YY/ZZ or PHAM/MK/XXXX/YY/ZZ
    
    // 1. Force PHAM at start
    if (input.length >= 4 && !input.startsWith("PHAM")) {
        input = "PHAM/" + input.replace(/^PHAM/, "");
    }
    
    // Ensure first slash after PHAM
    if (input.length > 4 && input[4] !== '/') {
        input = input.substring(0, 4) + '/' + input.substring(4);
    }
    
    // Adjust value back
    e.target.value = input;
    
    // Validate format
    const isValid = validateRegNumber(input);
    const feedback = document.getElementById("reg-no-feedback");
    
    if (input === "") {
        feedback.textContent = "";
        e.target.style.borderColor = "";
    } else if (isValid) {
        feedback.textContent = "✓ Registration format is correct";
        feedback.className = "feedback-msg success-text";
        e.target.style.borderColor = "var(--gold-primary)";
    } else {
        feedback.textContent = "✗ Must be PHAM/M/XXXX/YY/ZZ or PHAM/MK/XXXX/YY/ZZ";
        feedback.className = "feedback-msg error-text";
        e.target.style.borderColor = "#ef4444";
    }
}

function validateRegNumber(regNo) {
    // Regex matches PHAM/M/XXXX/YY/ZZ or PHAM/MK/XXXX/YY/ZZ
    // M or MK, 4 digits, 2 digits, 2 digits
    const regex = /^PHAM\/(M|MK)\/\d{4}\/\d{2}\/\d{2}$/i;
    return regex.test(regNo);
}

// ================= REGISTRATION SUBMISSION =================
async function handleRegistration(event) {
    event.preventDefault();
    
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const regNo = document.getElementById("reg-no").value.trim().toUpperCase();
    const year = document.getElementById("reg-year").value;
    
    // Validation Checks
    if (!name || !email || !regNo || !year) {
        alert("Please fill in all the registration fields.");
        return;
    }
    
    if (!validateRegNumber(regNo)) {
        alert("Invalid registration number. Please double check the format (PHAM/M/XXXX/YY/ZZ or PHAM/MK/XXXX/YY/ZZ).");
        return;
    }
    
    // Extract 4-digit number (3rd block of registration number)
    const segments = regNo.split("/");
    const fourDigitNo = segments[2];
    
    // Ticket Code generation: (year * 100) then 4-digit number
    // Year 1 -> 100 + XXXX = 100XXXX
    // Year 5 -> 500 + XXXX = 500XXXX
    const codePrefix = year * 100;
    const ticketCode = `${codePrefix}${fourDigitNo}`;
    
    const registrationData = {
        name,
        email,
        regNo,
        year,
        code: ticketCode
    };
    
    try {
        // Save to Database / LocalStorage
        const savedRecord = await window.galaDb.saveRegistration(registrationData);
        
        // Populate Invitation Letter
        document.getElementById("letter-name").textContent = savedRecord.name;
        document.getElementById("letter-reg-no").textContent = savedRecord.regNo;
        document.getElementById("letter-code").textContent = savedRecord.code;
        
        // Switch to the invitation view
        switchView('invitation');
        
        // Reset the registration form
        document.getElementById("registration-form").reset();
        document.getElementById("reg-no-feedback").textContent = "";
        document.getElementById("reg-no").style.borderColor = "";
        
    } catch (error) {
        console.error("Error during registration:", error);
        alert("Registration failed. Please try again.");
    }
}

// Print Invitation Letter Function
function printInvitation() {
    window.print();
}

// ================= ADMIN SECURITY =================
function handleAdminLogin(event) {
    event.preventDefault();
    const password = document.getElementById("admin-password").value;
    const feedback = document.getElementById("login-feedback");
    
    // Security check (default password is admin2026)
    if (password === "admin2026") {
        isAdminAuthenticated = true;
        feedback.textContent = "";
        switchView('admin-dashboard');
    } else {
        feedback.textContent = "Invalid administrator password. Access denied.";
        document.getElementById("admin-password").focus();
    }
}

function logoutAdmin() {
    isAdminAuthenticated = false;
    switchView('register');
}

// ================= ADMIN PORTAL DATA DISPLAY =================
function updateAdminStats() {
    if (!document.getElementById("stat-total")) return;
    
    const total = allAttendees.length;
    const yearCounts = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    
    allAttendees.forEach(att => {
        if (yearCounts[att.year] !== undefined) {
            yearCounts[att.year]++;
        }
    });
    
    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-y1").textContent = yearCounts["1"];
    document.getElementById("stat-y2").textContent = yearCounts["2"];
    document.getElementById("stat-y3").textContent = yearCounts["3"];
    document.getElementById("stat-y4").textContent = yearCounts["4"];
    document.getElementById("stat-y5").textContent = yearCounts["5"];
}

function updateAttendeeTable() {
    const tableBody = document.getElementById("attendee-table-body");
    if (!tableBody) return;
    
    if (allAttendees.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="color: var(--text-muted); padding: 2rem;">
                    No attendees registered yet.
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort attendees by study year (Year 1 first, up to Year 5), then name alphabetically
    const sortedAttendees = [...allAttendees].sort((a, b) => {
        if (a.year !== b.year) {
            return parseInt(a.year) - parseInt(b.year);
        }
        return a.name.localeCompare(b.name);
    });
    
    tableBody.innerHTML = sortedAttendees.map(att => `
        <tr>
            <td>
                <span class="table-name">${escapeHTML(att.name)}</span>
                <span class="table-email">${escapeHTML(att.email)}</span>
            </td>
            <td>
                <span class="table-reg-no">${escapeHTML(att.regNo)}</span>
            </td>
            <td class="text-center">
                <span class="table-year-badge">Year ${att.year}</span>
            </td>
            <td class="text-right">
                <span class="table-code-text">${escapeHTML(att.code)}</span>
            </td>
            <td class="text-center">
                <button class="delete-btn" title="Delete Attendee" onclick="deleteAttendee('${att.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function deleteAttendee(id) {
    const attendee = allAttendees.find(a => a.id === id);
    const name = attendee ? attendee.name : "this attendee";
    
    if (confirm(`Are you sure you want to remove ${name} from the registrations?`)) {
        try {
            await window.galaDb.deleteRegistration(id);
            // The DB listener automatically updates the table, stats, and lottery wheel
        } catch (error) {
            console.error("Failed to delete attendee:", error);
            alert("Failed to delete attendee.");
        }
    }
}

// ================= LOTTERY WHEEL / REEL LOGIC =================

/**
 * Populates the lottery wheel container with registered codes.
 * @param {boolean} forceReshuffle - forces a random shuffle of codes.
 */
function rebuildLotteryReel(forceReshuffle = false) {
    const reel = document.getElementById("lottery-reel");
    if (!reel) return;

    if (allAttendees.length === 0) {
        reel.innerHTML = '<div class="reel-item">No Codes</div>';
        return;
    }

    // Map attendees to codes list
    let list = allAttendees.map(att => ({
        code: att.code,
        name: att.name,
        year: att.year
    }));

    // Random shuffle if forced or if size changed (to keep it random as requested: "codes should be randomly placed")
    if (forceReshuffle || lotteryCodes.length !== list.length) {
        lotteryCodes = shuffleArray(list);
    } else {
        // Ensure codes correspond to current attendees list
        const codeMap = new Map(list.map(item => [item.code, item]));
        // Filter existing ordered codes to match current database (removing deleted, keeping others)
        lotteryCodes = lotteryCodes.filter(item => codeMap.has(item.code));
        // Add any missing ones
        list.forEach(item => {
            if (!lotteryCodes.some(c => c.code === item.code)) {
                lotteryCodes.push(item);
            }
        });
    }

    // Render codes
    // We add empty space padding divs at top and bottom so the first and last codes can be centered
    reel.innerHTML = lotteryCodes.map((item, idx) => `
        <div class="reel-item" data-index="${idx}" data-code="${item.code}" onclick="centerCodeOnReel('${item.code}')">
            ${item.code}
        </div>
    `).join('');

    // Trigger centering highlight on whatever sits at center initially
    setTimeout(highlightCenterItem, 100);
}

/**
 * Triggers on scroll to locate and highlight the item centered in the viewport.
 */
function highlightCenterItem() {
    const reel = document.getElementById("lottery-reel");
    if (!reel || allAttendees.length === 0) return;

    const items = reel.querySelectorAll(".reel-item");
    if (items.length === 0) return;

    const reelRect = reel.getBoundingClientRect();
    const centerLine = reelRect.top + reelRect.height / 2;

    let closestItem = null;
    let minDistance = Infinity;

    items.forEach(item => {
        const itemRect = item.getBoundingClientRect();
        const itemCenter = itemRect.top + itemRect.height / 2;
        const distance = Math.abs(itemCenter - centerLine);

        if (distance < minDistance) {
            minDistance = distance;
            closestItem = item;
        }
    });

    // Toggle center classes
    items.forEach(item => {
        if (item === closestItem) {
            item.classList.add("center-highlight");
            
            // Sync specific code input field if we are NOT currently typing inside it
            const targetInput = document.getElementById("target-code-input");
            if (targetInput && document.activeElement !== targetInput && !isSpinning) {
                targetInput.value = item.getAttribute("data-code");
            }
        } else {
            item.classList.remove("center-highlight");
        }
    });
}

/**
 * Smoothly scrolls the reel to bring a specific code directly to the center line.
 */
function centerCodeOnReel(code, duration = 400) {
    const reel = document.getElementById("lottery-reel");
    if (!reel) return;

    const targetItem = reel.querySelector(`.reel-item[data-code="${code}"]`);
    if (!targetItem) return;

    // Calculate centering offset
    const reelHeight = reel.clientHeight;
    const itemOffset = targetItem.offsetTop;
    const itemHeight = targetItem.clientHeight;

    const targetScrollTop = itemOffset - (reelHeight / 2) + (itemHeight / 2);

    // Smooth scroll implementation
    smoothScrollTo(reel, targetScrollTop, duration);
}

/**
 * Handles typing into the Specific Code Search/Focalizer input
 */
function handleTargetCodeInput(value) {
    if (isSpinning) return;
    
    const cleanedCode = value.trim();
    if (cleanedCode.length === 0) return;

    // Check if the code is in our list
    const match = lotteryCodes.some(item => item.code === cleanedCode);
    if (match) {
        centerCodeOnReel(cleanedCode, 300);
    }
}

function clearTargetCodeInput() {
    const targetInput = document.getElementById("target-code-input");
    if (targetInput) {
        targetInput.value = "";
        targetInput.focus();
    }
}

// ================= LOTTERY SPIN MECHANICS =================
function spinLottery() {
    if (isSpinning || allAttendees.length === 0) return;

    isSpinning = true;
    
    // UI Loading state
    const btn = document.getElementById("btn-spin-lottery");
    const textSpan = document.getElementById("spin-text");
    const spinner = document.getElementById("spin-spinner");
    const winnerBanner = document.getElementById("winner-announcement");
    
    if (btn) btn.disabled = true;
    if (textSpan) textSpan.textContent = " Drawing Winner...";
    if (spinner) spinner.classList.remove("hidden");
    if (winnerBanner) winnerBanner.classList.add("hidden");

    const reel = document.getElementById("lottery-reel");
    
    // Choose a random winner from list
    const randomIndex = Math.floor(Math.random() * lotteryCodes.length);
    const winnerObj = lotteryCodes[randomIndex];

    // High performance spin mechanics:
    // 1. Rapidly cycle scrolling up and down to create a "spinning wheel" blur effect
    // 2. Slow down and smoothly lock onto the winner
    let currentScroll = reel.scrollTop;
    const maxScroll = reel.scrollHeight - reel.clientHeight;
    let velocity = 50; // pixels per frame
    let direction = 1; // 1 = down, -1 = up
    let ticks = 0;
    const maxTicks = 120; // 2 seconds of high speed spin (60fps)

    function animateSpin() {
        ticks++;
        
        // Boundary bounce logic for drum effect
        currentScroll += velocity * direction;
        if (currentScroll >= maxScroll) {
            currentScroll = maxScroll;
            direction = -1;
        } else if (currentScroll <= 0) {
            currentScroll = 0;
            direction = 1;
        }

        reel.scrollTop = currentScroll;
        
        // Update highlight classes dynamically for blur simulation
        highlightCenterItem();

        if (ticks < maxTicks) {
            // Decelerate slightly over time
            if (ticks > maxTicks * 0.7) {
                velocity *= 0.94; // Easing friction
            }
            requestAnimationFrame(animateSpin);
        } else {
            // Phase 2: Decelerate directly into the final winner code
            centerCodeOnReel(winnerObj.code, 1200);
            
            // Finish spin after scroll completes
            setTimeout(() => {
                isSpinning = false;
                
                if (btn) btn.disabled = false;
                if (textSpan) textSpan.innerHTML = '<i class="fa-solid fa-clover"></i> Spin Lottery Winner';
                if (spinner) spinner.classList.add("hidden");
                
                // Show Winner Panel
                document.getElementById("winner-name").textContent = winnerObj.name;
                document.getElementById("winner-details").textContent = `Code: ${winnerObj.code} (Year ${winnerObj.year})`;
                
                if (winnerBanner) {
                    winnerBanner.classList.remove("hidden");
                    winnerBanner.style.display = "flex";
                }
                
                // Update target input to match winner code
                const targetInput = document.getElementById("target-code-input");
                if (targetInput) targetInput.value = winnerObj.code;
                
            }, 1300);
        }
    }

    requestAnimationFrame(animateSpin);
}

// ================= UTILITY FUNCTIONS =================

/**
 * Smooth scroll helper implementing easing instead of standard linear CSS scroll behavior.
 */
function smoothScrollTo(element, target, duration) {
    const start = element.scrollTop;
    const change = target - start;
    let startTime = null;

    function animate(currentTime) {
        if (!startTime) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = easeInOutCubic(timeElapsed, start, change, duration);
        element.scrollTop = run;

        if (timeElapsed < duration) {
            requestAnimationFrame(animate);
        } else {
            element.scrollTop = target;
            highlightCenterItem();
        }
    }

    // Easing cubic equation
    function easeInOutCubic(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t * t + b;
        t -= 2;
        return c / 2 * (t * t * t + 2) + b;
    }

    requestAnimationFrame(animate);
}

/**
 * Fisher-Yates array shuffling algorithm.
 */
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Debouncing scroll listeners for optimal CPU performance.
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Simple HTML escape method to guard against XSS injection vulnerabilities.
 */
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
