




const AppState = {
    apiKey: '',
    javascriptCode: '',
    uiConfig: null,
    formattedJavaCode: '',
    trace: [],
    result: null,
    currentStepIdx: -1,
    playbackTimer: null,
    playbackSpeedMs: 1000,
    isPlaying: false
};


const elements = {
    geminiKey: document.getElementById('gemini-key'),
    saveKeyBtn: document.getElementById('save-key-btn'),
    keyIndicator: document.getElementById('key-status-indicator'),
    
    problemDesc: document.getElementById('problem-desc'),
    solutionLang: document.getElementById('solution-lang'),
    geminiModel: document.getElementById('gemini-model'),
    solutionCode: document.getElementById('solution-code'),
    transpileBtn: document.getElementById('transpile-btn'),
    
    testcaseSection: document.getElementById('testcase-section'),
    dynamicInputs: document.getElementById('dynamic-inputs-container'),
    runBtn: document.getElementById('run-btn'),
    
    emptyCanvas: document.getElementById('empty-canvas-message'),
    visualizerCanvas: document.getElementById('visualizer-canvas'),
    typeLabel: document.getElementById('visualizer-type-label'),
    
    timelineSlider: document.getElementById('timeline-slider'),
    stepLabel: document.getElementById('current-step-label'),
    speedSlider: document.getElementById('speed-slider'),
    speedValue: document.getElementById('speed-value'),
    
    prevBtn: document.getElementById('prev-btn'),
    playBtn: document.getElementById('play-btn'),
    nextBtn: document.getElementById('next-btn'),
    
    codeViewer: document.getElementById('code-viewer-code'),
    variablesWatch: document.getElementById('variables-watch-tbody'),
    logsContainer: document.getElementById('logs-container'),
    clearLogsBtn: document.getElementById('clear-logs-btn'),
    toast: document.getElementById('toast-message')
};


window.addEventListener('DOMContentLoaded', () => {
    
    const savedKey = localStorage.getItem('algolens_gemini_key');
    if (savedKey) {
        AppState.apiKey = savedKey;
        elements.geminiKey.value = savedKey;
        updateKeyStatusIndicator(true);
        loadAvailableModels(); 
    } else {
        updateKeyStatusIndicator(false);
    }
    
    
    const savedLang = localStorage.getItem('algolens_solution_lang');
    if (savedLang) {
        elements.solutionLang.value = savedLang;
    }
    const savedModel = localStorage.getItem('algolens_gemini_model');
    if (savedModel) {
        elements.geminiModel.value = savedModel;
    }
    
    
    elements.saveKeyBtn.addEventListener('click', saveApiKey);
    elements.transpileBtn.addEventListener('click', transpileSolution);
    elements.runBtn.addEventListener('click', executeTrace);
    
    elements.prevBtn.addEventListener('click', stepBackward);
    elements.nextBtn.addEventListener('click', stepForward);
    elements.playBtn.addEventListener('click', togglePlayback);
    
    elements.timelineSlider.addEventListener('input', (e) => {
        jumpToStep(parseInt(e.target.value));
    });
    
    elements.speedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        
        const delay = Math.max(100, 2000 - (val - 1) * 200);
        AppState.playbackSpeedMs = delay;
        elements.speedValue.innerText = `${(1000 / delay).toFixed(1)}x`;
        if (AppState.isPlaying) {
            pausePlayback();
            startPlayback();
        }
    });

    elements.clearLogsBtn.addEventListener('click', () => {
        elements.logsContainer.innerHTML = '';
    });
    initResizers();
});


function showToast(message, isError = false) {
    elements.toast.innerText = message;
    elements.toast.className = 'toast';
    if (isError) elements.toast.classList.add('toast-error');
    else elements.toast.classList.add('toast-success');
    
    elements.toast.classList.remove('hidden');
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}


function saveApiKey() {
    const key = elements.geminiKey.value.trim();
    if (!key) {
        localStorage.removeItem('algolens_gemini_key');
        AppState.apiKey = '';
        updateKeyStatusIndicator(false);
        showToast("API Key cleared", true);
        elements.geminiModel.innerHTML = `
            <option value="gemini-3.5-flash">Gemini 3.5 Flash (Free Tier)</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Free Tier)</option>
        `;
    } else {
        localStorage.setItem('algolens_gemini_key', key);
        AppState.apiKey = key;
        updateKeyStatusIndicator(true);
        showToast("API Key saved successfully");
        loadAvailableModels();
    }
}


async function loadAvailableModels() {
    if (!AppState.apiKey) return;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${AppState.apiKey}`);
        if (!response.ok) return;
        const data = await response.json();
        
        
        const activeModels = data.models
            .filter(m => m.supportedMethods && m.supportedMethods.some(method => method.toLowerCase().includes('generatecontent')))
            .map(m => m.name.replace('models/', ''));
            
        if (activeModels.length === 0) return;

        
        elements.geminiModel.innerHTML = '';
        activeModels.forEach(modelId => {
            const option = document.createElement('option');
            option.value = modelId;
            
            const nameParts = modelId.split('-').map(p => {
                if (p === 'exp') return 'Experimental';
                return p.charAt(0).toUpperCase() + p.slice(1);
            });
            
            let tierText = '';
            const lowerId = modelId.toLowerCase();
            if (lowerId.includes('flash') || lowerId.includes('lite') || lowerId.includes('nano')) {
                tierText = ' (Free Tier)';
            } else if (lowerId.includes('pro')) {
                tierText = ' (Free / Paid Limits)';
            } else {
                tierText = ' (Free)';
            }
            
            option.innerText = nameParts.join(' ') + tierText;
            elements.geminiModel.appendChild(option);
        });
        
        
        const savedModel = localStorage.getItem('algolens_gemini_model');
        if (savedModel && activeModels.includes(savedModel)) {
            elements.geminiModel.value = savedModel;
        } else if (activeModels.includes('gemini-3.5-flash')) {
            elements.geminiModel.value = 'gemini-3.5-flash';
        }
    } catch (e) {
        console.error("Failed to load dynamic model list:", e);
    }
}

function updateKeyStatusIndicator(hasKey) {
    if (hasKey) {
        elements.keyIndicator.innerText = "Key Set";
        elements.keyIndicator.className = "status-indicator status-active";
    } else {
        elements.keyIndicator.innerText = "No Key";
        elements.keyIndicator.className = "status-indicator status-empty";
    }
}


function parseLeetCodeTree(arr) {
    if (!arr || arr.length === 0 || arr[0] === null) return null;
    const root = { val: arr[0], left: null, right: null };
    const queue = [root];
    let i = 1;
    while (queue.length > 0 && i < arr.length) {
        const curr = queue.shift();
        
        if (arr[i] !== null && arr[i] !== undefined) {
            curr.left = { val: arr[i], left: null, right: null };
            queue.push(curr.left);
        }
        i++;
        
        if (i < arr.length && arr[i] !== null && arr[i] !== undefined) {
            curr.right = { val: arr[i], left: null, right: null };
            queue.push(curr.right);
        }
        i++;
    }
    return root;
}


async function transpileSolution() {
    if (!AppState.apiKey) {
        showToast("Please enter and save a Gemini API Key first", true);
        return;
    }
    
    const desc = elements.problemDesc.value.trim();
    const code = elements.solutionCode.value.trim();
    const lang = elements.solutionLang.value;
    const model = elements.geminiModel.value;
    
    if (!desc || !code) {
        showToast("Please fill in the Problem Info and Solution Code", true);
        return;
    }

    
    localStorage.setItem('algolens_solution_lang', lang);
    localStorage.setItem('algolens_gemini_model', model);
    
    elements.transpileBtn.disabled = true;
    elements.transpileBtn.innerHTML = `
        <svg class="spinning btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
            <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
        </svg> Transpiling...
    `;
    
    const promptText = `
Given this LeetCode problem description and solution code written in ${lang.toUpperCase()}:

Problem Description:
${desc}

${lang.toUpperCase()} Solution:
\`\`\`${lang}
${code}
\`\`\`

You must perform three tasks:
1. Standardize and format the ${lang.toUpperCase()} code. Do not include line numbers in the string itself.
2. Transpile the ${lang.toUpperCase()} code to a fully functioning JavaScript body that will run in the browser using "new Function('args', ...)".
3. **CRITICAL STEP: Instrument the JavaScript code** to record a step-by-step trace of its execution into a local 'trace' array.

The javascriptCode you return must be a clean Javascript body string (runnable via \`new Function\`).
Structure of the javascriptCode body:
\`\`\`javascript
const [param1, param2, ...] = args; // Grab inputs in order
const trace = [];

// Initialize data structures if needed
// Run the algorithm step by step. On every line of code, push a trace step:
trace.push({
  line: 4, // 1-based index matching the line in formattedSourceCode
  explanation: "Brief description of what is happening in this line",
  variables: { i: 0, j: nums.length - 1, ans: null },
  visuals: {
    type: "array", // Must match the visualization type for the problem: 'array', 'matrix', 'tree', 'graph', 'disjoint-set', or 'stack'
    data: {
      array: nums, // If visualizer is 'array'
      matrix: grid, // If visualizer is 'matrix' / 'dp'
      tree: rootNode, // If visualizer is 'tree'
      graph: adjList, // If visualizer is 'graph'
      parent: parentArr, // If visualizer is 'disjoint-set'
      stack: recursionStack // If visualizer is 'stack'
    },
    highlights: {
      pointers: { i: 0, j: nums.length - 1 }, // Map pointer label to array index
      active: [0, 5], // indices, coordinates e.g. [[r,c]], node IDs
      visited: [1, 2],
      success: [3],
      window: { start: 1, end: 4 }, // Sliding window bounds
      edges: [[0, 1]] // Graph edges highlight
    }
  }
});

// Continue execution and loop through algorithm logic recording trace entries at EVERY assignment, comparison, swap, visited node, etc.

// Finally, return the result and trace
return { result: finalAnswer, trace: trace };
\`\`\`

For complex structures:
- **Graphs**: Input 'args' might be an edge list like [[0,1],[1,2]]. Parse it to a dictionary mapping node -> array of neighbor nodes, e.g. { "0": [1], "1": [0, 2], "2": [1] }, and put this dictionary in data.graph.
- **Trees**: If input arg is a TreeNode root, it will be pre-parsed into an object layout: { val: X, left: TreeNode, right: TreeNode }. Put this in data.tree.
- **Disjoint Sets**: data.parent must show the actual parent values array.
- **Backtracking**: Show the active recursive call frame path (LIFO stack) in data.stack.

Format your output exactly matching the JSON Schema provided.
`;

    
    let attempt = 0;
    let parsedResult = null;
    let currentModel = model;
    
    
    const availableModelOptions = Array.from(elements.geminiModel.options).map(opt => opt.value);
    const backupModels = availableModelOptions.filter(m => m !== model);
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    while (attempt < 3) {
        try {
            if (attempt > 0) {
                showToast(`Retrying transpilation with ${currentModel} (Attempt ${attempt + 1}/3)...`, true);
            }
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${AppState.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: promptText }]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                javascriptCode: {
                                    type: "STRING",
                                    description: "The runnable JavaScript function body that performs the algorithm and returns { result, trace }."
                                },
                                uiConfig: {
                                    type: "OBJECT",
                                    properties: {
                                        type: {
                                            type: "STRING",
                                            enum: ["array", "matrix", "tree", "graph", "disjoint-set", "stack"]
                                        },
                                        args: {
                                            type: "ARRAY",
                                            items: {
                                                type: "OBJECT",
                                                properties: {
                                                    name: { type: "STRING" },
                                                    type: {
                                                        type: "STRING",
                                                        enum: ["array", "matrix", "tree", "graph", "number", "string"]
                                                    },
                                                    placeholder: { type: "STRING" }
                                                },
                                                required: ["name", "type"]
                                            }
                                        }
                                    },
                                    required: ["type", "args"]
                                },
                                formattedSourceCode: {
                                    type: "STRING",
                                    description: "The clean source code to display, line-by-line. Each line mapped from trace.line values."
                                }
                            },
                            required: ["javascriptCode", "uiConfig", "formattedSourceCode"]
                        }
                    }
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                let errorMsg = `API error ${response.status} - `;
                if (response.status === 503) {
                    errorMsg += "Gemini model overloaded/unavailable.";
                } else if (response.status === 429) {
                    errorMsg += "Rate limit exceeded (Too Many Requests).";
                } else {
                    errorMsg += errBody;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            const responseText = data.candidates[0].content.parts[0].text;
            parsedResult = JSON.parse(responseText);
            break; 
            
        } catch (err) {
            console.warn(`Attempt ${attempt + 1} failed:`, err);
            attempt++;
            
            if (attempt < 3) {
                
                const nextModel = backupModels.shift();
                if (nextModel) {
                    currentModel = nextModel;
                    
                    elements.geminiModel.value = currentModel;
                }
                await sleep(2000);
            } else {
                
                showToast("All retries failed. Gemini models are experiencing high load. Please try again in a few seconds.", true);
                throw err;
            }
        }
    }

    try {
        
        AppState.javascriptCode = parsedResult.javascriptCode;
        AppState.uiConfig = parsedResult.uiConfig;
        AppState.formattedJavaCode = parsedResult.formattedSourceCode;
        
        
        renderCodeTracer(parsedResult.formattedSourceCode);
        
        
        renderInputForm(parsedResult.uiConfig.args);
        
        showToast("Transpiled and ready to run!");
        
        
        setTimeout(() => {
            elements.testcaseSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 150);
    } catch (err) {
        console.error("Transpilation processing error:", err);
        showToast("Failed to process transpile result. Verify model output schema.", true);
    } finally {
        elements.transpileBtn.disabled = false;
        elements.transpileBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg> Transpile & Instrument
        `;
    }
}


function renderCodeTracer(javaCode) {
    elements.codeViewer.innerHTML = '';
    const lines = javaCode.split('\n');
    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const lineDiv = document.createElement('div');
        lineDiv.className = 'code-line';
        lineDiv.id = `code-line-${lineNum}`;
        
        const numSpan = document.createElement('span');
        numSpan.className = 'code-line-num';
        numSpan.innerText = lineNum;
        
        const contentSpan = document.createElement('span');
        contentSpan.className = 'code-line-content';
        contentSpan.innerText = line;
        
        lineDiv.appendChild(numSpan);
        lineDiv.appendChild(contentSpan);
        elements.codeViewer.appendChild(lineDiv);
    });
}


function renderInputForm(args) {
    elements.dynamicInputs.innerHTML = '';
    
    args.forEach(arg => {
        const group = document.createElement('div');
        group.className = 'form-group mt-3';
        
        const label = document.createElement('label');
        label.innerText = `${arg.name} (${arg.type})`;
        
        let input;
        if (arg.type === 'number') {
            input = document.createElement('input');
            input.type = 'number';
            input.value = arg.placeholder || '0';
        } else {
            input = document.createElement('input');
            input.type = 'text';
            
            if (arg.type === 'array') input.value = arg.placeholder || '[2, 7, 11, 15]';
            else if (arg.type === 'matrix') input.value = arg.placeholder || '[[1, 2], [3, 4]]';
            else if (arg.type === 'tree') input.value = arg.placeholder || '[3, 9, 20, null, null, 15, 7]';
            else if (arg.type === 'graph') input.value = arg.placeholder || '[[0, 1], [1, 2]]';
            else input.value = '';
        }
        
        input.id = `input-arg-${arg.name}`;
        input.dataset.type = arg.type;
        
        group.appendChild(label);
        group.appendChild(input);
        elements.dynamicInputs.appendChild(group);
    });
    
    elements.testcaseSection.classList.remove('hidden');
}


function executeTrace() {
    if (!AppState.javascriptCode) {
        showToast("No active transpiled solution. Click Transpile first.", true);
        return;
    }
    
    
    const parsedArgs = [];
    const argsConfig = AppState.uiConfig.args;
    
    try {
        argsConfig.forEach(arg => {
            const inputEl = document.getElementById(`input-arg-${arg.name}`);
            const rawVal = inputEl.value.trim();
            
            if (arg.type === 'number') {
                parsedArgs.push(Number(rawVal));
            } else if (arg.type === 'string') {
                parsedArgs.push(rawVal);
            } else {
                
                let parsed = JSON.parse(rawVal);
                if (arg.type === 'tree') {
                    
                    parsed = parseLeetCodeTree(parsed);
                }
                parsedArgs.push(parsed);
            }
        });
    } catch (e) {
        console.error(e);
        showToast("Failed to parse inputs. Ensure they are valid JSON arrays/numbers.", true);
        return;
    }
    
    
    pausePlayback();
    AppState.trace = [];
    AppState.currentStepIdx = -1;
    
    
    try {
        const runner = new Function('args', AppState.javascriptCode);
        const output = runner(parsedArgs);
        
        AppState.trace = output.trace || [];
        AppState.result = output.result;
        
        if (AppState.trace.length === 0) {
            showToast("Algorithm completed, but no trace steps were recorded. Transpile again.", true);
            return;
        }
        
        
        elements.timelineSlider.disabled = false;
        elements.timelineSlider.max = AppState.trace.length - 1;
        elements.timelineSlider.min = 0;
        elements.timelineSlider.value = 0;
        
        elements.prevBtn.disabled = false;
        elements.playBtn.disabled = false;
        elements.nextBtn.disabled = false;
        
        elements.emptyCanvas.classList.add('hidden');
        elements.visualizerCanvas.classList.remove('hidden');
        elements.typeLabel.innerText = `${AppState.uiConfig.type.toUpperCase()} VISUALIZER`;
        
        
        elements.logsContainer.innerHTML = '';
        
        
        jumpToStep(0);
        showToast("Algorithm trace generated. Start playback!");
    } catch (err) {
        console.error("Local runner crash:", err);
        showToast(`Runner crashed: ${err.message}`, true);
    }
}


function jumpToStep(idx) {
    if (idx < 0 || idx >= AppState.trace.length) return;
    
    AppState.currentStepIdx = idx;
    elements.timelineSlider.value = idx;
    elements.stepLabel.innerText = `${idx + 1} / ${AppState.trace.length}`;
    
    const step = AppState.trace[idx];
    
    
    Visualizers.draw(step.visuals, elements.visualizerCanvas);
    
    
    const activeLine = document.querySelector('.code-line.active');
    if (activeLine) activeLine.classList.remove('active');
    
    const newLine = document.getElementById(`code-line-${step.line}`);
    if (newLine) {
        newLine.classList.add('active');
        const container = document.querySelector('.code-container-scroll');
        if (container) {
            container.scrollTo({
                top: newLine.offsetTop - container.clientHeight / 2 + newLine.clientHeight / 2,
                behavior: 'smooth'
            });
        }
    }
    
    
    updateVariablesWatch(step.variables || {});
    
    
    updateLogsList(idx, step.explanation);
}

function updateVariablesWatch(vars) {
    elements.variablesWatch.innerHTML = '';
    const entries = Object.entries(vars);
    
    if (entries.length === 0) {
        elements.variablesWatch.innerHTML = `
            <tr>
                <td colspan="2" class="empty-table-message">No active variables</td>
            </tr>
        `;
        return;
    }
    
    entries.forEach(([name, val]) => {
        const tr = document.createElement('tr');
        
        const nameTd = document.createElement('td');
        nameTd.style.fontWeight = 'bold';
        nameTd.innerText = name;
        
        const valTd = document.createElement('td');
        valTd.innerText = typeof val === 'object' ? JSON.stringify(val) : val;
        
        tr.appendChild(nameTd);
        tr.appendChild(valTd);
        elements.variablesWatch.appendChild(tr);
    });
}

function updateLogsList(currentIdx, message) {
    
    let logEl = document.getElementById(`log-step-${currentIdx}`);
    
    
    const activeLog = document.querySelector('.log-entry.active');
    if (activeLog) activeLog.classList.remove('active');
    
    if (!logEl) {
        logEl = document.createElement('div');
        logEl.className = 'log-entry';
        logEl.id = `log-step-${currentIdx}`;
        logEl.innerHTML = `<span class="log-step-num">#${currentIdx + 1}</span> ${message || 'Step processed'}`;
        elements.logsContainer.appendChild(logEl);
    }
    
    logEl.classList.add('active');
    const container = elements.logsContainer;
    if (container) {
        const parentRect = container.getBoundingClientRect();
        const childRect = logEl.getBoundingClientRect();
        const relativeTop = childRect.top - parentRect.top + container.scrollTop;
        container.scrollTo({
            top: relativeTop - container.clientHeight / 2 + logEl.clientHeight / 2,
            behavior: 'smooth'
        });
    }
}


function stepForward() {
    if (AppState.trace.length === 0) {
        showToast("No active trace. Transpile and run a testcase first.", true);
        return;
    }
    if (AppState.currentStepIdx < AppState.trace.length - 1) {
        jumpToStep(AppState.currentStepIdx + 1);
    } else {
        pausePlayback();
        showToast("Trace completed!");
    }
}

function stepBackward() {
    if (AppState.trace.length === 0) {
        showToast("No active trace. Transpile and run a testcase first.", true);
        return;
    }
    if (AppState.currentStepIdx > 0) {
        jumpToStep(AppState.currentStepIdx - 1);
    }
}


function togglePlayback() {
    if (AppState.trace.length === 0) {
        showToast("No active trace. Transpile and run a testcase first.", true);
        return;
    }
    if (AppState.isPlaying) {
        pausePlayback();
    } else {
        startPlayback();
    }
}

function startPlayback() {
    AppState.isPlaying = true;
    elements.playBtn.querySelector('.play-icon').classList.add('hidden');
    elements.playBtn.querySelector('.pause-icon').classList.remove('hidden');
    if (AppState.currentStepIdx === AppState.trace.length - 1) {
        jumpToStep(0);
    }
    AppState.playbackTimer = setInterval(stepForward, AppState.playbackSpeedMs);
}

function pausePlayback() {
    AppState.isPlaying = false;
    elements.playBtn.querySelector('.play-icon').classList.remove('hidden');
    elements.playBtn.querySelector('.pause-icon').classList.add('hidden');
    if (AppState.playbackTimer) {
        clearInterval(AppState.playbackTimer);
        AppState.playbackTimer = null;
    }
}

function initResizers() {
    const container = document.querySelector('.split-pane-container');
    const leftPane = document.querySelector('.split-pane-left');
    const rightPane = document.querySelector('.split-pane-right');
    const divider = document.querySelector('.split-pane-divider');
    if (!container || !leftPane || !rightPane || !divider) return;
    
    let isDragging = false;
    
    divider.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.style.cursor = 'col-resize';
        divider.classList.add('dragging');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const containerRect = container.getBoundingClientRect();
        const leftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        if (leftWidth >= 15 && leftWidth <= 85) {
            leftPane.style.width = `${leftWidth}%`;
            rightPane.style.width = `${100 - leftWidth}%`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = 'default';
            divider.classList.remove('dragging');
        }
    });

    divider.addEventListener('touchstart', (e) => {
        isDragging = true;
        divider.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        if (e.touches.length === 0) return;
        const containerRect = container.getBoundingClientRect();
        const touchX = e.touches[0].clientX;
        const leftWidth = ((touchX - containerRect.left) / containerRect.width) * 100;
        if (leftWidth >= 15 && leftWidth <= 85) {
            leftPane.style.width = `${leftWidth}%`;
            rightPane.style.width = `${100 - leftWidth}%`;
        }
    });

    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            divider.classList.remove('dragging');
        }
    });
}
