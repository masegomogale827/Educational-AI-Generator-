// Use API key from config
const API_KEY = config.GEMINI_API_KEY;

// Global variables
let currentLessonData = null;
let savedLessons = [];
let performanceHistory = [];
let generationStartTime = null;

// Performance tracking constants
const TOKENS_PER_WORD = 1.3; // Average tokens per word for English text
const TOKENS_PER_CHAR = 0.25; // Average tokens per character

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  loadSavedLessons();
  loadPerformanceHistory();
  setupEventListeners();
  updateDailyStats();
});

// Setup all event listeners
function setupEventListeners() {
  // Form submission
  document.getElementById("lessonForm").addEventListener("submit", handleFormSubmit);
  
  // Export buttons
  document.getElementById("saveToLocal").addEventListener("click", saveToLocalStorage);
  document.getElementById("exportPDF").addEventListener("click", exportAsPDF);
  document.getElementById("exportWord").addEventListener("click", exportAsWord);
  document.getElementById("exportText").addEventListener("click", exportAsText);
  document.getElementById("downloadFile").addEventListener("click", downloadFile);
  
  // Clear all saved
  document.getElementById("clearAllSaved").addEventListener("click", clearAllSaved);
  
  // Clear performance history
  document.getElementById("clearPerformanceHistory").addEventListener("click", clearPerformanceHistory);
  
  // Documentation toggle
  document.getElementById("toggleDocs").addEventListener("click", toggleDocumentation);
  
  // Cost calculator
  document.getElementById("calculateCost").addEventListener("click", calculateUsageCost);
  
  // Auto-calculate when inputs change
  document.getElementById("inputTokens").addEventListener("input", calculateUsageCost);
  document.getElementById("outputTokens").addEventListener("input", calculateUsageCost);
  document.getElementById("numRequests").addEventListener("input", calculateUsageCost);
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  const grade = document.getElementById("grade").value;
  const term = document.getElementById("term").value;
  const lessonStyle = document.getElementById("lessonStyle").value;
  const output = document.getElementById("lessonContent");
  const generateBtn = document.getElementById("generateBtn");
  const buttonText = generateBtn.querySelector(".button-text");
  const loadingSpinner = generateBtn.querySelector(".loading-spinner");

  if (!API_KEY) {
    output.textContent = "Error: API key is not configured. Please add your Gemini API key to the script.";
    return;
  }

  // Start performance tracking
  generationStartTime = performance.now();
  
  // Disable button and show loading state
  generateBtn.disabled = true;
  buttonText.textContent = "Generating...";
  loadingSpinner.style.display = "inline-block";
  output.textContent = "Generating CAPS-aligned lesson plan...";

  // Dynamic prompt based on selected lesson style
  const promptTemplates = {
    "Theory": `Create a CAPS-aligned History theory lesson plan for Grade ${grade}, Term ${term}. Include:
1. Topic and sub-topic
2. Lesson objectives
3. Key concepts and background
4. Step-by-step teacher activities
5. Conclusion and reflection`,

    "Activity-Based": `Design a CAPS-compliant History lesson for Grade ${grade}, Term ${term} using an activity-based approach. Include:
1. Topic overview
2. Hands-on or group activities
3. Learner participation
4. Real-world connections
5. Class discussion guide`,

    "Mixed": `Develop a CAPS-aligned mixed-mode History lesson (theory + activities) for Grade ${grade}, Term ${term}. Include:
1. Intro (theory)
2. Activities that apply knowledge
3. Assessment integration
4. Use of visuals/maps/charts
5. Wrap-up summary`,

    "Assessment-Focused": `Generate a History lesson plan for Grade ${grade}, Term ${term} that includes informal and formal CAPS-aligned assessments. Include:
1. Lesson objectives
2. Pre-lesson recap
3. In-class activities
4. Quiz, worksheet, or oral assessment
5. Marking guidance`,

    "Revision": `Provide a History revision lesson plan for Grade ${grade}, Term ${term} under the CAPS curriculum. Include:
1. Key concepts recap
2. Timeline or summary tool
3. Question & answer activities
4. Self-assessment or peer review
5. Final takeaway points`
  };

  const prompt = promptTemplates[lessonStyle];
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
 
  try {
    console.log('Sending request to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}. Details: ${errorText}`);
    }

    const data = await response.json();
    console.log('Response data:', data);
    
    if (data.error) {
      throw new Error(data.error.message || 'API Error');
    }

    const lessonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!lessonText) {
      throw new Error('No content generated');
    }

    // Calculate performance metrics
    const generationEndTime = performance.now();
    const generationTime = (generationEndTime - generationStartTime) / 1000; // Convert to seconds
    
    // Estimate token usage
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(lessonText);
    const totalTokens = inputTokens + outputTokens;
    const tokensPerSecond = totalTokens / generationTime;

    // Store current lesson data with performance metrics
    currentLessonData = {
      grade: grade,
      term: term,
      lessonStyle: lessonStyle,
      content: lessonText,
      timestamp: new Date().toISOString(),
      id: Date.now().toString(),
      performance: {
        generationTime: generationTime,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        totalTokens: totalTokens,
        tokensPerSecond: tokensPerSecond
      }
    };

    output.textContent = lessonText;
    
    // Update performance metrics display
    updatePerformanceMetrics(currentLessonData.performance);
    
    // Show performance metrics and export buttons
    document.getElementById("performanceMetrics").style.display = "block";
    document.getElementById("exportButtons").style.display = "block";
    
    // Save performance data
    savePerformanceData(currentLessonData);
    
  } catch (err) {
    console.error('Full error:', err);
    output.textContent = `Error generating lesson plan: ${err.message}. Please try again later.`;
  } finally {
    // Reset button state
    generateBtn.disabled = false;
    buttonText.textContent = "Generate Lesson Plan";
    loadingSpinner.style.display = "none";
  }
}

// Estimate token count for text
function estimateTokens(text) {
  if (!text) return 0;
  
  // Use word-based estimation (more accurate for English text)
  const words = text.trim().split(/\s+/).length;
  return Math.round(words * TOKENS_PER_WORD);
}

// Update performance metrics display
function updatePerformanceMetrics(performance) {
  document.getElementById("generationTime").textContent = `${performance.generationTime.toFixed(2)}s`;
  document.getElementById("inputTokens").textContent = performance.inputTokens.toLocaleString();
  document.getElementById("outputTokens").textContent = performance.outputTokens.toLocaleString();
  document.getElementById("totalTokens").textContent = performance.totalTokens.toLocaleString();
  document.getElementById("tokensPerSecond").textContent = performance.tokensPerSecond.toFixed(1);
  
  // Calculate and display estimated cost
  const inputCost = (performance.inputTokens / 1000) * 0.00025;
  const outputCost = (performance.outputTokens / 1000) * 0.0005;
  const totalCost = inputCost + outputCost;
  
  // Update calculator with current values
  document.getElementById("inputTokens").value = performance.inputTokens;
  document.getElementById("outputTokens").value = performance.outputTokens;
  calculateUsageCost();
  
  // Update daily stats
  updateDailyStats();
}

// Save performance data
function savePerformanceData(lessonData) {
  try {
    const performanceData = {
      id: lessonData.id,
      timestamp: lessonData.timestamp,
      grade: lessonData.grade,
      term: lessonData.term,
      lessonStyle: lessonData.lessonStyle,
      performance: lessonData.performance
    };
    
    // Load existing performance history
    const existing = localStorage.getItem('capsPerformanceHistory');
    performanceHistory = existing ? JSON.parse(existing) : [];
    
    // Add new performance data
    performanceHistory.unshift(performanceData);
    
    // Keep only last 50 performance records
    if (performanceHistory.length > 50) {
      performanceHistory = performanceHistory.slice(0, 50);
    }
    
    // Save to localStorage
    localStorage.setItem('capsPerformanceHistory', JSON.stringify(performanceHistory));
    
    // Update performance history display
    updatePerformanceHistory();
    
  } catch (error) {
    console.error('Error saving performance data:', error);
  }
}

// Load performance history
function loadPerformanceHistory() {
  try {
    const existing = localStorage.getItem('capsPerformanceHistory');
    performanceHistory = existing ? JSON.parse(existing) : [];
    updatePerformanceHistory();
  } catch (error) {
    console.error('Error loading performance history:', error);
    performanceHistory = [];
  }
}

// Update performance history display
function updatePerformanceHistory() {
  const historyContainer = document.getElementById("performanceHistory");
  
  if (performanceHistory.length === 0) {
    historyContainer.innerHTML = '<p style="color: rgba(255,255,255,0.7); font-style: italic; text-align: center;">No performance data yet.</p>';
    return;
  }
  
  historyContainer.innerHTML = '';
  
  performanceHistory.slice(0, 10).forEach((record) => {
    const historyElement = createPerformanceHistoryElement(record);
    historyContainer.appendChild(historyElement);
  });
}

// Create performance history element
function createPerformanceHistoryElement(record) {
  const div = document.createElement('div');
  div.className = 'history-item';
  
  const date = new Date(record.timestamp).toLocaleString();
  const title = `Grade ${record.grade} - Term ${record.term} - ${record.lessonStyle}`;
  const perf = record.performance;
  
  div.innerHTML = `
    <div class="history-header">
      <div class="history-title">${title}</div>
      <div class="history-time">${date}</div>
    </div>
    <div class="history-metrics">
      <div class="history-metric">
        <span class="history-metric-label">Time:</span>
        <span class="history-metric-value">${perf.generationTime.toFixed(2)}s</span>
      </div>
      <div class="history-metric">
        <span class="history-metric-label">Input:</span>
        <span class="history-metric-value">${perf.inputTokens}</span>
      </div>
      <div class="history-metric">
        <span class="history-metric-label">Output:</span>
        <span class="history-metric-value">${perf.outputTokens}</span>
      </div>
      <div class="history-metric">
        <span class="history-metric-label">Total:</span>
        <span class="history-metric-value">${perf.totalTokens}</span>
      </div>
      <div class="history-metric">
        <span class="history-metric-label">Speed:</span>
        <span class="history-metric-value">${perf.tokensPerSecond.toFixed(1)}/s</span>
      </div>
    </div>
  `;
  
  return div;
}

// Update daily statistics
function updateDailyStats() {
  try {
    const today = new Date().toDateString();
    const todayRecords = performanceHistory.filter(record => 
      new Date(record.timestamp).toDateString() === today
    );
    
    document.getElementById("generatedToday").textContent = todayRecords.length;
    
  } catch (error) {
    console.error('Error updating daily stats:', error);
    document.getElementById("generatedToday").textContent = "0";
  }
}

// Clear performance history
function clearPerformanceHistory() {
  if (confirm('Are you sure you want to clear all performance history? This action cannot be undone.')) {
    localStorage.removeItem('capsPerformanceHistory');
    performanceHistory = [];
    updatePerformanceHistory();
    updateDailyStats();
  }
}

// Save to Local Storage
function saveToLocalStorage() {
  if (!currentLessonData) {
    alert("No lesson plan to save. Please generate a lesson plan first.");
    return;
  }

  try {
    // Load existing saved lessons
    const existing = localStorage.getItem('capsLessonPlans');
    savedLessons = existing ? JSON.parse(existing) : [];
    
    // Add current lesson
    savedLessons.unshift(currentLessonData);
    
    // Keep only last 20 saved lessons
    if (savedLessons.length > 20) {
      savedLessons = savedLessons.slice(0, 20);
    }
    
    // Save to localStorage
    localStorage.setItem('capsLessonPlans', JSON.stringify(savedLessons));
    
    // Update display
    loadSavedLessons();
    
    alert("Lesson plan saved successfully!");
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    alert("Error saving lesson plan. Please try again.");
  }
}

// Load saved lessons from localStorage
function loadSavedLessons() {
  try {
    const existing = localStorage.getItem('capsLessonPlans');
    savedLessons = existing ? JSON.parse(existing) : [];
    
    const savedResultsList = document.getElementById("savedResultsList");
    const clearAllBtn = document.getElementById("clearAllSaved");
    
    if (savedLessons.length === 0) {
      savedResultsList.innerHTML = '<p style="color: #6c757d; font-style: italic;">No saved lesson plans yet.</p>';
      clearAllBtn.style.display = "none";
    } else {
      savedResultsList.innerHTML = '';
      clearAllBtn.style.display = "block";
      
      savedLessons.forEach((lesson, index) => {
        const lessonElement = createSavedLessonElement(lesson, index);
        savedResultsList.appendChild(lessonElement);
      });
    }
  } catch (error) {
    console.error('Error loading saved lessons:', error);
  }
}

// Create saved lesson element
function createSavedLessonElement(lesson, index) {
  const div = document.createElement('div');
  div.className = 'saved-result-item';
  
  const date = new Date(lesson.timestamp).toLocaleString();
  const title = `Grade ${lesson.grade} - Term ${lesson.term} - ${lesson.lessonStyle}`;
  const preview = lesson.content.substring(0, 150) + (lesson.content.length > 150 ? '...' : '');
  
  div.innerHTML = `
    <div class="saved-result-header">
      <div class="saved-result-title">${title}</div>
      <div class="saved-result-date">${date}</div>
    </div>
    <div class="saved-result-content" id="content-${index}">
      ${preview}
    </div>
    <div class="saved-result-actions">
      <button class="expand-btn" onclick="toggleContent(${index})">
        <i class="fas fa-expand-alt"></i> Expand
      </button>
      <button class="delete-btn" onclick="deleteSavedLesson(${index})">
        <i class="fas fa-trash"></i> Delete
      </button>
      <button class="export-btn" onclick="exportSavedLesson(${index})" style="background: #007bff;">
        <i class="fas fa-download"></i> Export
      </button>
    </div>
  `;
  
  return div;
}

// Toggle content expansion
function toggleContent(index) {
  const contentElement = document.getElementById(`content-${index}`);
  const lesson = savedLessons[index];
  
  if (contentElement.classList.contains('expanded')) {
    contentElement.textContent = lesson.content.substring(0, 150) + (lesson.content.length > 150 ? '...' : '');
    contentElement.classList.remove('expanded');
  } else {
    contentElement.textContent = lesson.content;
    contentElement.classList.add('expanded');
  }
}

// Delete saved lesson
function deleteSavedLesson(index) {
  if (confirm('Are you sure you want to delete this saved lesson plan?')) {
    savedLessons.splice(index, 1);
    localStorage.setItem('capsLessonPlans', JSON.stringify(savedLessons));
    loadSavedLessons();
  }
}

// Export saved lesson
function exportSavedLesson(index) {
  const lesson = savedLessons[index];
  currentLessonData = lesson;
  
  // Show export options
  const exportButtons = document.getElementById("exportButtons");
  exportButtons.style.display = "block";
  
  // Scroll to export section
  exportButtons.scrollIntoView({ behavior: 'smooth' });
}

// Clear all saved lessons
function clearAllSaved() {
  if (confirm('Are you sure you want to delete all saved lesson plans? This action cannot be undone.')) {
    localStorage.removeItem('capsLessonPlans');
    savedLessons = [];
    loadSavedLessons();
  }
}

// Export as PDF
function exportAsPDF() {
  if (!currentLessonData) {
    alert("No lesson plan to export. Please generate a lesson plan first.");
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('CAPS History Lesson Plan', 20, 20);
    
    // Add metadata
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Grade: ${currentLessonData.grade}`, 20, 35);
    doc.text(`Term: ${currentLessonData.term}`, 20, 42);
    doc.text(`Style: ${currentLessonData.lessonStyle}`, 20, 49);
    doc.text(`Generated: ${new Date(currentLessonData.timestamp).toLocaleString()}`, 20, 56);
    
    // Add performance metrics if available
    if (currentLessonData.performance) {
      doc.text(`Generation Time: ${currentLessonData.performance.generationTime.toFixed(2)}s`, 20, 63);
      doc.text(`Total Tokens: ${currentLessonData.performance.totalTokens}`, 20, 70);
    }
    
    // Add content
    doc.setFontSize(11);
    const splitText = doc.splitTextToSize(currentLessonData.content, 170);
    doc.text(splitText, 20, currentLessonData.performance ? 80 : 70);
    
    // Save file
    const filename = `CAPS_Lesson_Grade${currentLessonData.grade}_Term${currentLessonData.term}_${currentLessonData.lessonStyle.replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert("Error generating PDF. Please try again.");
  }
}

// Export as Word document
function exportAsWord() {
  if (!currentLessonData) {
    alert("No lesson plan to export. Please generate a lesson plan first.");
    return;
  }

  try {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "CAPS History Lesson Plan",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Grade: ${currentLessonData.grade}`, bold: true }),
              new TextRun({ text: " | " }),
              new TextRun({ text: `Term: ${currentLessonData.term}`, bold: true }),
              new TextRun({ text: " | " }),
              new TextRun({ text: `Style: ${currentLessonData.lessonStyle}`, bold: true })
            ],
            spacing: { after: 200 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Generated: ${new Date(currentLessonData.timestamp).toLocaleString()}`, size: 20 })
            ],
            spacing: { after: 200 }
          }),
          // Add performance metrics if available
          ...(currentLessonData.performance ? [
            new Paragraph({
              children: [
                new TextRun({ text: `Generation Time: ${currentLessonData.performance.generationTime.toFixed(2)}s`, size: 20 }),
                new TextRun({ text: " | " }),
                new TextRun({ text: `Total Tokens: ${currentLessonData.performance.totalTokens}`, size: 20 })
              ],
              spacing: { after: 200 }
            })
          ] : []),
          new Paragraph({
            text: currentLessonData.content,
            spacing: { after: 200 }
          })
        ]
      }]
    });
    
    Packer.toBlob(doc).then(blob => {
      const filename = `CAPS_Lesson_Grade${currentLessonData.grade}_Term${currentLessonData.term}_${currentLessonData.lessonStyle.replace(/\s+/g, '_')}.docx`;
      saveAs(blob, filename);
    });
    
  } catch (error) {
    console.error('Error generating Word document:', error);
    alert("Error generating Word document. Please try again.");
  }
}

// Export as Text
function exportAsText() {
  if (!currentLessonData) {
    alert("No lesson plan to export. Please generate a lesson plan first.");
    return;
  }

  try {
    let content = `CAPS History Lesson Plan
=======================

Grade: ${currentLessonData.grade}
Term: ${currentLessonData.term}
Style: ${currentLessonData.lessonStyle}
Generated: ${new Date(currentLessonData.timestamp).toLocaleString()}`;

    // Add performance metrics if available
    if (currentLessonData.performance) {
      content += `

Performance Metrics:
-------------------
Generation Time: ${currentLessonData.performance.generationTime.toFixed(2)}s
Input Tokens: ${currentLessonData.performance.inputTokens}
Output Tokens: ${currentLessonData.performance.outputTokens}
Total Tokens: ${currentLessonData.performance.totalTokens}
Tokens/Second: ${currentLessonData.performance.tokensPerSecond.toFixed(1)}`;
    }

    content += `

${currentLessonData.content}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const filename = `CAPS_Lesson_Grade${currentLessonData.grade}_Term${currentLessonData.term}_${currentLessonData.lessonStyle.replace(/\s+/g, '_')}.txt`;
    saveAs(blob, filename);
    
  } catch (error) {
    console.error('Error generating text file:', error);
    alert("Error generating text file. Please try again.");
  }
}

// Download file (generic download)
function downloadFile() {
  if (!currentLessonData) {
    alert("No lesson plan to download. Please generate a lesson plan first.");
    return;
  }

  try {
    let content = `CAPS History Lesson Plan
=======================

Grade: ${currentLessonData.grade}
Term: ${currentLessonData.term}
Style: ${currentLessonData.lessonStyle}
Generated: ${new Date(currentLessonData.timestamp).toLocaleString()}`;

    // Add performance metrics if available
    if (currentLessonData.performance) {
      content += `

Performance Metrics:
-------------------
Generation Time: ${currentLessonData.performance.generationTime.toFixed(2)}s
Input Tokens: ${currentLessonData.performance.inputTokens}
Output Tokens: ${currentLessonData.performance.outputTokens}
Total Tokens: ${currentLessonData.performance.totalTokens}
Tokens/Second: ${currentLessonData.performance.tokensPerSecond.toFixed(1)}`;
    }

    content += `

${currentLessonData.content}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const filename = `CAPS_Lesson_Grade${currentLessonData.grade}_Term${currentLessonData.term}_${currentLessonData.lessonStyle.replace(/\s+/g, '_')}.txt`;
    saveAs(blob, filename);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    alert("Error downloading file. Please try again.");
  }
}

// Toggle documentation section
function toggleDocumentation() {
  const content = document.getElementById("documentationContent");
  const button = document.getElementById("toggleDocs");
  const icon = document.getElementById("docsIcon");
  
  if (content.style.display === "none") {
    content.style.display = "block";
    button.classList.add("active");
    icon.style.transform = "rotate(180deg)";
  } else {
    content.style.display = "none";
    button.classList.remove("active");
    icon.style.transform = "rotate(0deg)";
  }
}

// Calculate usage cost
function calculateUsageCost() {
  const inputTokens = parseFloat(document.getElementById("inputTokens").value) || 0;
  const outputTokens = parseFloat(document.getElementById("outputTokens").value) || 0;
  const numRequests = parseFloat(document.getElementById("numRequests").value) || 1;
  
  // Google AI pricing (as of 2024)
  const inputCostPer1K = 0.00025; // $0.00025 per 1K input tokens
  const outputCostPer1K = 0.0005; // $0.0005 per 1K output tokens
  
  // Calculate costs
  const inputCost = (inputTokens / 1000) * inputCostPer1K;
  const outputCost = (outputTokens / 1000) * outputCostPer1K;
  const costPerRequest = inputCost + outputCost;
  const totalCost = costPerRequest * numRequests;
  
  // Update display
  document.getElementById("totalCost").textContent = `$${totalCost.toFixed(4)}`;
  document.getElementById("costPerRequest").textContent = `$${costPerRequest.toFixed(4)}`;
  
  // Add color coding based on cost
  const totalCostElement = document.getElementById("totalCost");
  const costPerRequestElement = document.getElementById("costPerRequest");
  
  if (totalCost > 1.00) {
    totalCostElement.style.color = "#dc3545"; // Red for high cost
  } else if (totalCost > 0.50) {
    totalCostElement.style.color = "#fd7e14"; // Orange for medium cost
  } else {
    totalCostElement.style.color = "#28a745"; // Green for low cost
  }
  
  if (costPerRequest > 0.10) {
    costPerRequestElement.style.color = "#dc3545";
  } else if (costPerRequest > 0.05) {
    costPerRequestElement.style.color = "#fd7e14";
  } else {
    costPerRequestElement.style.color = "#28a745";
  }
}
