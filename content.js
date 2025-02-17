/* 
Deus Deceptor: https://andybromberg.com/deus-deceptor
Copyright (C) 2025 Andy Bromberg andy@andybromberg.com

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>. 
*/

const elementMap = new Map();
let elementCounter = 0;
let transformationRules = [];
let processedNodes = new WeakSet();
let isTransforming = false;
let model = 'gemini-2.0-flash';

let similarityThreshold = 0.95;
let highlightTransformed = false;

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SCRAMBLE_INTERVAL = 50;
const OPACITY = 0.5;

const animationCleanupMap = new Map();

const BLOCK_CONTAINERS = ['p', 'article', 'section', 'div'];
const MAX_ANCESTOR_LEVELS = 4;
const MAX_RELATED_NODES = 6;

function getRandomChar() {
    return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function startScrambleAnimation(textNode, originalText) {
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-scramble-wrapper', 'true');
    textNode.parentNode.insertBefore(wrapper, textNode);
    wrapper.appendChild(textNode);
    
    wrapper.style.opacity = OPACITY;
    
    let counter = 0;
    const scrambleIntervals = [];
    
    const scrambleText = () => {
        const parts = originalText.split(/(\S+)/);
        const scrambled = parts.map(part => {
            if (part.trim() === '') {
                return part;
            }
            return part.split('').map(char => getRandomChar()).join('');
        }).join('');
        
        textNode.textContent = scrambled;
    };

    const intervalId = setInterval(scrambleText, SCRAMBLE_INTERVAL);
    scrambleIntervals.push(intervalId);

    return () => {
        scrambleIntervals.forEach(id => clearInterval(id));
        wrapper.parentNode.insertBefore(textNode, wrapper);
        wrapper.remove();
    };
}

chrome.storage.sync.get(['transformationRules', 'similarityThreshold', 'highlightTransformed', 'model'], (result) => {
    transformationRules = result.transformationRules || [];
    
    if (result.similarityThreshold) {
        similarityThreshold = parseFloat(result.similarityThreshold);
    }
    if (result.highlightTransformed !== undefined) {
        highlightTransformed = result.highlightTransformed;
    }
    
    if (transformationRules.length > 0) {
        findMatchingElements(document.body);
        scheduleTransformation();
    }

    if (result.model) {
        model = result.model;
    }
});

function scheduleTransformation() {
    if (!isTransforming && elementMap.size > 0) {
        isTransforming = true;
        setTimeout(async () => {
            await transformElements();
            isTransforming = false;
            if (elementMap.size > 0) {
                scheduleTransformation();
            }
        }, 1000);
    }
}

function calculateSimilarity(str1, str2) {
    // First check for exact match after basic normalization
    const normalize = (s) => s.toLowerCase().trim().replace(/[.,!?'"]/g, '');
    const norm1 = normalize(str1);
    const norm2 = normalize(str2);
    
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
        console.debug('Exact match found after normalization:', {
            normalized1: norm1,
            normalized2: norm2
        });
        return true;
    }

    // Continue with existing fuzzy matching logic
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    
    console.debug('Comparing:', { 
        text1: str1, 
        text2: str2
    });

    // Split into words and clean each word
    const words1 = str1.trim().split(/\s+/).map(w => w.replace(/[.,!?'']/g, ''));
    const words2 = str2.trim().split(/\s+/).map(w => w.replace(/[.,!?'']/g, ''));
    
    for (const subject of words2) {
        for (const word of words1) {
            if (word.length < 4 || subject.length < 4) {
                continue;
            }
            
            const variations1 = getWordVariations(word);
            const variations2 = getWordVariations(subject);
            
            for (const v1 of variations1) {
                for (const v2 of variations2) {
                    const distance = levenshteinDistance(v1, v2);
                    const maxLength = Math.max(v1.length, v2.length);
                    const similarity = 1 - (distance / maxLength);
                    
                    console.debug('Fuzzy match check:', {
                        word: v1,
                        subject: v2,
                        distance,
                        similarity,
                        threshold: similarityThreshold
                    });
                    
                    if (similarity >= similarityThreshold) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function getWordVariations(word) {
    const variations = new Set([word]);
    
    variations.add(word.replace(/['']s$|s['']$|'s$/, ''));
    
    variations.add(word.replace(/s$/, ''));
    
    if (!word.endsWith('s')) {
        variations.add(word + 's');
    }
    
    if (!word.endsWith("'s")) {
        variations.add(word + "'s");
    }

    if (!word.endsWith("'") && word.endsWith("s")) {
        variations.add(word + "'");
    }
        
    return Array.from(variations);
}

function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j - 1] + 1,
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1
                );
            }
        }
    }
    return dp[m][n];
}

function collectTextNodes(element) {
    const textNodes = [];
    
    let container = element;
    while (container && !container.dataset.transformContainer) {
        container = container.parentElement;
    }
    
    if (!container || !container.dataset.transformRange) {
        console.log('No transform container found, processing single element');
        return [element];
    }
    
    const [start, end] = container.dataset.transformRange.split(',').map(Number);
    const paragraphs = Array.from(container.children).filter(el => 
        el.tagName.toLowerCase() === 'p'
    );
    
    const relevantParagraphs = paragraphs.slice(start, end + 1);
    
    for (const paragraph of relevantParagraphs) {
        const walker = document.createTreeWalker(
            paragraph,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (processedNodes.has(node)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    const text = node.textContent.trim();
                    if (text.length < 2) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        
        let node;
        while ((node = walker.nextNode()) && textNodes.length < MAX_RELATED_NODES) {
            textNodes.push(node);
        }
        
        if (textNodes.length >= MAX_RELATED_NODES) {
            break;
        }
    }
    
    delete container.dataset.transformRange;
    delete container.dataset.transformContainer;
    
    return textNodes;
}

function findMatchingElements(rootNode) {
    const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                if (processedNodes.has(node)) {
                    return NodeFilter.FILTER_REJECT;
                }
                
                // Skip empty or whitespace-only nodes
                if (!node.textContent.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                
                let parent = node.parentElement;
                for (let i = 0; i < 2 && parent; i++) {
                    if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || 
                        parent.tagName === 'CODE' || parent.tagName === 'PRE') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    parent = parent.parentElement;
                }
                
                const text = node.textContent.trim();
                const ruleGroups = new Map();
                transformationRules.forEach(rule => {
                    const key = rule.rule;
                    if (!ruleGroups.has(key)) {
                        ruleGroups.set(key, []);
                    }
                    ruleGroups.get(key).push(rule.subject);
                });

                const matchesAnySubject = Array.from(ruleGroups.values()).some(subjects => 
                    subjects.some(subject => calculateSimilarity(text, subject))
                );
                
                return matchesAnySubject
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        }
    );

    let node;
    while (node = walker.nextNode()) {
        let parentElement = node.parentElement;
        while (parentElement && getComputedStyle(parentElement).display === 'inline') {
            parentElement = parentElement.parentElement;
        }

        if (parentElement) {
            // Find the common container and related nodes
            const container = findCommonContainer(parentElement);
            let nodesToProcess;
            
            if (container) {
                console.log('Found container, collecting related nodes...');
                nodesToProcess = collectTextNodes(container);
                console.log(`Collected ${nodesToProcess.length} related nodes`);
            } else {
                console.log('No container found, processing single node');
                nodesToProcess = [node];
            }

            const text = node.textContent.trim();
            const ruleGroups = new Map();
            
            // Find matching rules for the main node
            transformationRules.forEach(rule => {
                if (calculateSimilarity(text, rule.subject)) {
                    if (!ruleGroups.has(rule.rule)) {
                        ruleGroups.set(rule.rule, true);
                    }
                }
            });

            const matchingRules = Array.from(ruleGroups.keys());
            
            // Process all nodes (main node and related nodes)
            nodesToProcess.forEach(textNode => {
                if (!processedNodes.has(textNode)) {
                    const elementId = `elem_${elementCounter++}`;
                    const nodeText = textNode.textContent;
                    
                    elementMap.set(elementId, {
                        element: textNode.parentElement,
                        textNode: textNode,
                        text: nodeText,
                        originalText: nodeText,
                        rules: matchingRules,
                        isRelated: textNode !== node
                    });

                    const cleanup = startScrambleAnimation(textNode, nodeText);
                    animationCleanupMap.set(elementId, cleanup);
                }
            });
        }
    }

    if (elementMap.size > 0) {
        scheduleTransformation();
    }
}

async function transformElements() {
    if (elementMap.size === 0) return;

    const result = await chrome.storage.sync.get(['apiKey']);
    if (!result.apiKey) {
        console.error('No API key set. Please set it in the extension options.');
        return;
    }

    const MAX_ELEMENTS = 5;
    const elements = Array.from(elementMap.entries())
        .slice(0, MAX_ELEMENTS)
        .map(([id, data]) => ({
            id,
            text: data.text,
            rules: data.rules
        }));

    if (elements.length === 0) {
        console.log('No elements to transform');
        return;
    }

    const prompt = `You are a text transformation system. Transform each text according to its specific rules.

Format:
- Each text block is wrapped in [TEXT_START] and [TEXT_END] tags
- Each block has an ID, rules to apply, and the original text, each encased by a corresponding pair of tags
- Your response should ONLY include the transformed texts, each wrapped in [RESPONSE_START:ID] and [RESPONSE_END:ID] tags
- DO NOT include any explanations or additional text
- Keep the transformed test ROUGHLY the same length (+/- 20%) as the original text, unless specifically instructed otherwise
- If there is a space at the beginning or end of the original text, preserve it in the transformed text

For example, if given the input:

[TEXT_START]
<id>elem_1</id>
<rules>rewrite as if a pirate said it</rules>
<text>hello my name is bob</text>
[TEXT_END]

[TEXT_START]
<id>elem_2</id>
<rules>pretend that elvis has not died</rules>
<text>elvis died on august 16, 1977</text>
[TEXT_END]

You would return:

[RESPONSE_START:elem_1]
arr matey, me name is bob
[RESPONSE_END:elem_1]

[RESPONSE_START:elem_2]
elvis is still alive and well
[RESPONSE_END:elem_2]

Now, here are the texts to transform:

${elements.map(elem => 
    `[TEXT_START]
<id>${elem.id}</id>
<rules>${elem.rules.join('; ')}</rules>
<text>${elem.text}</text>
[TEXT_END]`
).join('\n\n')}

Remember: Return ONLY the transformed text inside the [RESPONSE_START:ID][RESPONSE_END:ID] tags. Do NOT include any other text or explanations, and do NOT include any other tags such as </text>.`;

    try {
        console.log('Sending request to Gemini API...');
        console.log('Request prompt:', prompt);

        const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/';
        const apiUrl = `${baseUrl}${model}:generateContent?key=${result.apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API request failed:', response.status, errorText);
            return;
        }

        const data = await response.json();
        console.log('API Response:', data);

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Invalid API response structure:', JSON.stringify(data, null, 2));
            return;
        }

        const transformedContent = data.candidates[0].content.parts[0].text;
        console.log('Transformed content:', transformedContent);
        
        const regex = /\[RESPONSE_START:(elem_\d+)\]([\s\S]*?)\[RESPONSE_END:\1\]/g;
        let match;
        
        while ((match = regex.exec(transformedContent)) !== null) {
            const [_, id, newText] = match;
            const elementData = elementMap.get(id);
            
            if (elementData && elementData.textNode) {
                const cleanup = animationCleanupMap.get(id);
                if (cleanup) {
                    cleanup();
                    animationCleanupMap.delete(id);
                }

                if (highlightTransformed) {
                    const span = document.createElement('span');
                    span.style.backgroundColor = 'rgba(200, 170, 110, 0.08)';
                    span.style.borderBottom = '2px solid rgba(110, 11, 20, 0.6)';
                    span.style.boxShadow = '0 2px 12px rgba(110, 11, 20, 0.15)';
                    span.style.padding = '0 3px';
                    span.style.borderRadius = '3px';
                    span.style.transition = 'all 0.3s ease';
                    span.style.display = 'inline';
                    span.style.whiteSpace = 'normal';
                    
                    // Trim any leading/trailing newlines but preserve other whitespace
                    const cleanText = newText.replace(/^\n+|\n+$/g, '');
                    const transformedNode = document.createTextNode(cleanText);
                    const originalText = elementData.originalText.replace(/^\n+|\n+$/g, '');
                    
                    span.addEventListener('mouseover', () => {
                        span.style.backgroundColor = 'rgba(110, 11, 20, 0.08)';
                        span.style.borderBottom = '2px solid rgba(110, 11, 20, 0.8)';
                        span.style.boxShadow = '0 2px 15px rgba(110, 11, 20, 0.25)';
                        transformedNode.textContent = originalText;
                    });
                    
                    span.addEventListener('mouseout', () => {
                        span.style.backgroundColor = 'rgba(200, 170, 110, 0.08)';
                        span.style.borderBottom = '2px solid rgba(110, 11, 20, 0.6)';
                        span.style.boxShadow = '0 2px 12px rgba(110, 11, 20, 0.15)';
                        transformedNode.textContent = cleanText;
                    });
                    
                    span.appendChild(transformedNode);
                    elementData.textNode.parentNode.replaceChild(span, elementData.textNode);
                    elementData.textNode = transformedNode;
                } else {
                    elementData.textNode.textContent = newText.replace(/^\n+|\n+$/g, '');
                }
                
                processedNodes.add(elementData.textNode);
                elementMap.delete(id);
            }
        }

        elements.forEach(elem => {
            if (elementMap.has(elem.id)) {
                const cleanup = animationCleanupMap.get(elem.id);
                if (cleanup) {
                    cleanup();
                    animationCleanupMap.delete(elem.id);
                }
                elementMap.delete(elem.id);
            }
        });

    } catch (error) {
        console.error('Error in transformElements:', error);
        elements.forEach(elem => {
            const cleanup = animationCleanupMap.get(elem.id);
            if (cleanup) {
                cleanup();
                animationCleanupMap.delete(elem.id);
            }
        });
    }
}

chrome.storage.onChanged.addListener((changes) => {
    if (changes.transformationRules) {
        animationCleanupMap.forEach(cleanup => cleanup());
        animationCleanupMap.clear();
        
        transformationRules = changes.transformationRules.newValue;
        elementMap.clear();
        processedNodes = new WeakSet();
        isTransforming = false;
        findMatchingElements(document.body);
    }
    if (changes.similarityThreshold) {
        similarityThreshold = parseFloat(changes.similarityThreshold.newValue);
        elementMap.clear();
        processedNodes = new WeakSet();
        isTransforming = false;
        findMatchingElements(document.body);
    }
    if (changes.highlightTransformed) {
        highlightTransformed = changes.highlightTransformed.newValue;
        if (!highlightTransformed) {
            document.querySelectorAll('span[style*="rgba(200, 170, 110, 0.08)"]').forEach(span => {
                const text = span.textContent;
                const textNode = document.createTextNode(text);
                span.parentNode.replaceChild(textNode, span);
            });
        }
    }
});

const observer = new MutationObserver((mutations) => {
    const relevantMutations = mutations.filter(mutation => {
        const hasWrapper = Array.from(mutation.addedNodes).some(node => 
            node.nodeType === Node.ELEMENT_NODE && 
            node.hasAttribute('data-scramble-wrapper')
        );
        return !hasWrapper;
    });

    if (relevantMutations.length > 0) {
        relevantMutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    findMatchingElements(node);
                }
            });
        });
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false
});

function findCommonContainer(element) {
    let container = element;
    let level = 0;
    const validContainers = ['ARTICLE', 'MAIN', 'SECTION', 'DIV'];
    
    while (container && level < MAX_ANCESTOR_LEVELS) {
        if (validContainers.includes(container.tagName)) {
            const paragraphs = Array.from(container.children).filter(el => 
                el.tagName.toLowerCase() === 'p'
            );
            
            if (paragraphs.length >= 2) {
                break;
            }
        }
        container = container.parentElement;
        level++;
    }
    
    if (!container || level >= MAX_ANCESTOR_LEVELS) {
        console.log('No suitable container found');
        return null;
    }
    
    let targetParagraph = element;
    while (targetParagraph && targetParagraph.parentElement !== container) {
        targetParagraph = targetParagraph.parentElement;
    }
    
    if (!targetParagraph) {
        console.log('Could not find target paragraph in container');
        return null;
    }
    
    const paragraphs = Array.from(container.children).filter(el => 
        el.tagName.toLowerCase() === 'p'
    );
    
    const currentIndex = paragraphs.indexOf(targetParagraph);
    if (currentIndex === -1) {
        console.log('Target paragraph not found in container paragraphs');
        return null;
    }
    
    console.log('Found', paragraphs.length, 'paragraphs, target is at index', currentIndex);
    
    const windowSize = Math.min(MAX_RELATED_NODES, paragraphs.length);
    const halfWindow = Math.floor(windowSize / 2);
    
    let start = Math.max(0, currentIndex - halfWindow);
    let end = Math.min(paragraphs.length - 1, currentIndex + halfWindow);
    
    if (end - start + 1 < windowSize) {
        if (start === 0) {
            end = Math.min(paragraphs.length - 1, start + windowSize - 1);
        } else if (end === paragraphs.length - 1) {
            start = Math.max(0, end - windowSize + 1);
        }
    }
    
    if (end - start > 0 && (end - start + 1) <= MAX_RELATED_NODES) {
        console.log('Found related paragraphs from index', start, 'to', end, 
                   '(', end - start + 1, 'paragraphs) in container:', container.tagName);
        
        container.dataset.transformRange = `${start},${end}`;
        container.dataset.transformContainer = 'true';
        return container;
    }
    
    console.log('No suitable paragraph range found');
    return null;
} 