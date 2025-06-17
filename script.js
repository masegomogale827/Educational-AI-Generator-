// Use API key from config
const API_KEY = config.GEMINI_API_KEY;

document.getElementById("lessonForm").addEventListener("submit", async function (e) {
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

    output.textContent = lessonText;
  } catch (err) {
    console.error('Full error:', err);
    output.textContent = `Error generating lesson plan: ${err.message}. Please try again later.`;
  } finally {
    // Reset button state
    generateBtn.disabled = false;
    buttonText.textContent = "Generate Lesson Plan";
    loadingSpinner.style.display = "none";
  }
});
