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

function showStatus(message, isError = false) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.display = 'block';
    status.className = 'status ' + (isError ? 'error' : 'success');
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

function createRuleContainer(subject = '', rule = '') {
    const container = document.createElement('div');
    container.className = 'rule-container';

    const subjectInput = document.createElement('input');
    subjectInput.type = 'text';
    subjectInput.placeholder = 'Subject(s) (e.g., topic1, topic2, topic3)';
    subjectInput.value = subject;
    subjectInput.className = 'subject-input';
    subjectInput.setAttribute('data-input-type', 'subject');

    const ruleInput = document.createElement('input');
    ruleInput.type = 'text';
    ruleInput.placeholder = 'Rule (e.g., rewrite in a happier tone)';
    ruleInput.value = rule;
    ruleInput.className = 'rule-input';
    ruleInput.setAttribute('data-input-type', 'rule');

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.className = 'remove';
    removeButton.onclick = () => container.remove();

    container.appendChild(subjectInput);
    container.appendChild(ruleInput);
    container.appendChild(removeButton);

    return container;
}

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(['apiKey'], (result) => {
        if (result.apiKey) {
            document.getElementById('apiKey').value = result.apiKey;
        }
    });

    chrome.storage.sync.get(['model'], (result) => {
        if (result.model) {
            document.getElementById('model').value = result.model;
        }
    });

    chrome.storage.sync.get(['transformationRules'], (result) => {
        const rules = result.transformationRules || [];
        const container = document.getElementById('rules-container');
        
        if (rules.length === 0) {
            container.appendChild(createRuleContainer());
        } else {
            const groupedRules = rules.reduce((acc, rule) => {
                if (!acc[rule.rule]) {
                    acc[rule.rule] = [];
                }
                acc[rule.rule].push(rule.subject);
                return acc;
            }, {});
            
            Object.entries(groupedRules).forEach(([rule, subjects]) => {
                container.appendChild(createRuleContainer(subjects.join(', '), rule));
            });
        }
    });

    chrome.storage.sync.get(['similarityThreshold', 'highlightTransformed'], (result) => {
        if (result.similarityThreshold) {
            document.getElementById('similarityThreshold').value = result.similarityThreshold;
        }
        if (result.highlightTransformed !== undefined) {
            document.getElementById('highlightTransformed').checked = result.highlightTransformed;
        }
    });
});

document.getElementById('saveApiKey').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    chrome.storage.sync.set({ apiKey }, () => {
        showStatus('API key saved successfully!');
    });
});

document.getElementById('saveModel').addEventListener('click', () => {
    const model = document.getElementById('model').value;
    chrome.storage.sync.set({ model }, () => {
        showStatus('Model saved successfully!');
    });
});

document.getElementById('addRule').addEventListener('click', () => {
    const container = document.getElementById('rules-container');
    container.appendChild(createRuleContainer());
});

document.getElementById('saveRules').addEventListener('click', () => {
    const rulesContainer = document.getElementById('rules-container');
    const containers = rulesContainer.querySelectorAll('.rule-container');
    
    console.debug('Found rule containers:', containers.length);
    
    const rules = Array.from(containers).map(container => {
        const subject = container.querySelector('.subject-input')?.value || '';
        const rule = container.querySelector('.rule-input')?.value || '';
        
        const subjects = subject ? subject.split(',').map(s => s.trim()).filter(s => s) : [];
        const trimmedRule = rule.trim();
        
        console.debug('Processing rule:', { subjects, rule: trimmedRule });
        
        if (!subjects.length || !trimmedRule) {
            return [];
        }
        
        return subjects.map(s => ({
            subject: s,
            rule: trimmedRule
        }));
    })
    .flat()
    .filter(rule => rule.subject && rule.rule);
    
    console.debug('Saving rules:', rules);

    chrome.storage.sync.set({ transformationRules: rules }, () => {
        if (chrome.runtime.lastError) {
            console.error('Error saving rules:', chrome.runtime.lastError);
            showStatus('Error saving rules: ' + chrome.runtime.lastError.message, true);
        } else {
            console.debug('Rules saved successfully');
            showStatus('Rules saved successfully!');
            
            chrome.storage.sync.get(['transformationRules'], (result) => {
                const container = document.getElementById('rules-container');
                container.innerHTML = '';
                
                const groupedRules = result.transformationRules.reduce((acc, rule) => {
                    if (!acc[rule.rule]) {
                        acc[rule.rule] = [];
                    }
                    acc[rule.rule].push(rule.subject);
                    return acc;
                }, {});
                
                Object.entries(groupedRules).forEach(([rule, subjects]) => {
                    container.appendChild(createRuleContainer(subjects.join(', '), rule));
                });
            });
        }
    });
});

document.getElementById('similarityThreshold').addEventListener('change', (e) => {
    chrome.storage.sync.set({ similarityThreshold: e.target.value });
});

document.getElementById('highlightTransformed').addEventListener('change', (e) => {
    chrome.storage.sync.set({ highlightTransformed: e.target.checked });
}); 