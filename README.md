# Deus Deceptor: Descartes as a Chrome extension

> [!CAUTION]
> I do not recommend using this extension. It is meant as a a proof of concept and a fun experiment. It may send personal data from webpages you visit to Google Gemini. And it may also deceive you. And it may not work as expected.

The philosopher René Descartes envisioned an all-powerful "evil demon" — the *deus deceptor* — who "employed all his energies in order to deceive me."

The (imagined) *deus deceptor* caused Descartes to perceive a different world than actually existed, and this concept led Descartes down all sorts of interesting pathways around dealing with doubt. (How can one reason about the world when unsure of the truth of your underlying perceptions?)

In exploring the concept in his *Meditations on First Philosophy*, he asks: 

>How do I know that he has not brought it about that there is no earth, no sky, no extended thing, no shape, no size, no place, while at the same time ensuring that all these things appear to me to exist just as they do now? 
>
>What is more, [...] may I not similarly go wrong every time I add two and three or count the sides of a square, or in some even simpler matter, if that is imaginable?

So, naturally, I built this idea into a AI-powered Chrome extension. And it turned out to be unexpectedly thought-provoking.

**[Read more](https://andybromberg.com/deus-deceptor) about the story behind Deus Deceptor and what I discovered while using it.**

## What is it?

You probably get most of your information about the world through your web browser. The Deus Deceptor™ extension takes advantage of this and — as Descartes would say — employs all its energies in order to deceive you.

The Deus Deceptor™ extension:
- looks at every webpage you load
- if there's content on that webpage that matches a certain concept the Deus is watching for,
- it passes that content (and its surroundings) to an AI model, which is tasked with re-writing the content to reflect a different reality
- and then it seamlessly replaces the original content with the new, altered content, leaving you none the wiser

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable the "Developer mode" toggle in the top right corner
4. Click "Load unpacked" and select the directory containing these files
5. The extension should now be installed and active
6. Click into "Details" and then "Extension options" to configure the extension

### Configuration

- **API Key**: You'll need an API key from Google Gemini (which I found to be the fastest option — important for this use case). You can get one [here](https://aistudio.google.com/apikey).
- **Model**: Gemini Flash 2.0 was fast and cost-effective for me.
- **Text Matching Strictness**: I usually have this on "Strict." The looser you put it, the more text will be rewritten, because the extension will be triggered by adjacent words to your subjects.
- **Highlight Transformed Text**: When enabled, any transformed text will be highlighted in a light red with a light red underline, and hovering over it will show the original text. If you leave this off, you will have no idea what has been rewritten.

**Transformation Rules**: Most importantly, add your own rules about what you want rewritten, and how.
- **Subjects**: These are the words that will trigger a transformation. If you input "alice" it will look for instances of the word Alice on pages you visit, and when it finds them, it will transform that text and some of its surroundings. You can enter a comma-separated list like "alice, bob, joe."
- **Rule**: This is the rule you want to apply to the text. For example, "rewrite in a happier tone" or "rewrite in gen z slang" or "rewrite but pretending that Bob does not exist at all."

## Usage

When enabled, the extension works automatically on any webpage you visit.

## License
This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

Deus Deceptor is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.