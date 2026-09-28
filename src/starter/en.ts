import type { StarterSpec } from "./types";

const en: StarterSpec = {
	domains: { redaccion: "Writing", analisis: "Analysis", organizacion: "Planning" },

	blocks: [
		{
			id: "no-inventar",
			titulo: "Do not make things up",
			texto: "Do not make up data, figures, names or references. If information is missing to answer, say so and ask for it instead of assuming it.",
		},
		{
			id: "pedir-aclaracion",
			titulo: "Ask for clarification",
			texto: "Before answering, if essential information is missing, ask me up to three specific questions and wait for my reply.",
		},
		{
			id: "tono-claro",
			titulo: "Clear tone",
			texto: "Write in short sentences, in the active voice and without jargon. If you use a technical term, explain it the first time it appears.",
		},
		{
			id: "indicar-supuestos",
			titulo: "State assumptions",
			texto: "At the end, list the assumptions you made to answer, so that I can correct them if they are wrong.",
		},
	],

	banks: [
		{
			key: "clasificar",
			titulo: "Examples of classifying inquiries",
			tarea_que_resuelve: "Input and output examples for sorting people's inquiries into fixed categories.",
			ejemplos: [
				{ input: "How can I change the address registered on my account?", output: "Category: Account details" },
				{ input: "I have been waiting three days for my order and nobody answers me.", output: "Category: Delivery complaint" },
				{ input: "Are you open on Saturdays, and until what time?", output: "Category: General information" },
			],
		},
		{
			key: "extraer",
			titulo: "Examples of extracting data from emails",
			tarea_que_resuelve: "Sample emails and the data sheet expected from each one.",
			ejemplos: [
				{
					input: "Hi, I'm Marta Ruiz. I need the signed contract sent to me before March 15, please.",
					output: "- Sender: Marta Ruiz\n- Request: send the signed contract\n- Deadline: March 15",
				},
				{
					input: "Good morning. I am writing from Norte Company to ask for a meeting next week.",
					output: "- Sender: Norte Company\n- Request: schedule a meeting\n- Deadline: next week",
				},
			],
		},
	],

	prompts: [
		{
			titulo: "Write a formal email",
			dominio: "redaccion",
			tarea: ["redactar"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Write a clear, short formal email from a purpose and some details.",
			nota_reutilizacion: "Change the recipient, the purpose and the details. Adjust the tone in the constraints if the email is friendlier.",
			bloques: ["tono-claro", "no-inventar"],
			prompt: `Role: You are a person with experience in formal written communication.

Context: I need to write an email to {{recipient|someone outside my organization|Who will receive it and how you relate to them}}. The purpose is: {{purpose||What you want to achieve with the email}}.

Task: Write the complete email, with subject, greeting, body and closing. Include these details: {{details|none in addition|Dates, figures or names that must appear}}.

Format: Subject on one line, then the body in no more than three short paragraphs.

Constraints: Formal and courteous tone. Do not add information I did not give you.`,
		},
		{
			titulo: "Rewrite a text in a different tone",
			dominio: "redaccion",
			tarea: ["adaptar-tono"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Rewrite an existing text in a different tone without changing its content.",
			nota_reutilizacion: "Paste your text and choose the tone. If the result changes the meaning, add to the constraints which sentences must stay the same.",
			bloques: ["tono-claro"],
			prompt: `Role: You are a text editor.

Context: I have a text that I want to adapt for {{audience|the general public|Who it is aimed at}}.

Task: Rewrite the text in a {{tone|friendly and professional|For example: formal, friendly, technical}} tone without changing its content.

Format: Give only the rewritten text, with the same order of ideas as the original.

Constraints: Keep all figures, names and dates exactly as they are.

Text:
{{text}}`,
		},
		{
			titulo: "Summarize a long document",
			dominio: "redaccion",
			tarea: ["resumir"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Summarize a long document into a short version for someone who has not read it.",
			nota_reutilizacion: "Change the length and who the summary is for. If the document is very long, paste it in parts.",
			bloques: ["no-inventar"],
			prompt: `Role: You are an analyst who prepares summaries for people with little time.

Context: The summary is for {{reader|someone who does not know the subject|Who will read it}}.

Task: Summarize the document at the end, highlighting the main ideas and the pending decisions or actions.

Format: One paragraph of no more than {{length|120|Maximum number of words}} words, followed by a list of the pending actions.

Constraints: Use only information from the document.

Document:
{{document}}`,
		},
		{
			titulo: "Classify inquiries into categories",
			dominio: "analisis",
			tarea: ["clasificar"],
			tecnica: ["few-shot"],
			sensibilidad: "general",
			tarea_que_resuelve: "Assign each incoming inquiry to a category from a fixed list.",
			nota_reutilizacion: "Change the categories in the prompt and update the examples in the linked bank so they use the same categories.",
			bloques: [],
			ejemplos: "clasificar",
			prompt: `Role: You are a person who sorts the inquiries that reach an organization.

Context: Each inquiry must end up in a single category.

Task: Classify the inquiry at the end.

Format: Answer only with "Category: " and the category name.

Constraints: Use only these categories: {{categories|Account details, Delivery complaint, General information|Comma-separated list}}. If none applies, answer "Category: Other".

Inquiry:
{{inquiry}}`,
		},
		{
			titulo: "Extract data from an email",
			dominio: "analisis",
			tarea: ["extraer-datos"],
			tecnica: ["few-shot"],
			sensibilidad: "general",
			tarea_que_resuelve: "Get a data sheet (sender, request, deadline) from an email.",
			nota_reutilizacion: "Change the sheet fields and adjust the examples in the linked bank so they show the same fields.",
			bloques: ["no-inventar"],
			ejemplos: "extraer",
			prompt: `Role: You are an assistant that organizes the information in emails.

Context: I need a short sheet for each email to record it.

Task: Extract the data from the email at the end.

Format: A list with the fields "Sender", "Request" and "Deadline", one per line.

Constraints: If a piece of data does not appear in the email, write "not stated".

Email:
{{email}}`,
		},
		{
			titulo: "Compare two options and recommend one",
			dominio: "analisis",
			tarea: ["comparar-decidir"],
			tecnica: ["chain-of-thought"],
			sensibilidad: "general",
			tarea_que_resuelve: "Compare two options with explicit criteria and recommend one, showing the reasoning.",
			nota_reutilizacion: "Change the options and the decision criteria. If your criteria have different weights, say so in the context.",
			bloques: ["indicar-supuestos"],
			criterios: [
				"List the known facts about each option",
				"Evaluate each option against the decision criteria provided",
				"Justify the recommendation and point out the main risk",
			],
			prompt: `Role: You are an advisor who helps people decide with good judgment.

Context: I must choose between {{optionA}} and {{optionB}}. The decision criteria are: {{criteria|cost, risk and time|What matters most for deciding}}.

Task: Reason step by step: first list the facts about each option, then evaluate each one against the criteria and finally recommend one.

Format: Three sections titled "Facts", "Evaluation" and "Recommendation".

Constraints: Do not make up data; if information is missing to evaluate a criterion, say so.`,
		},
		{
			titulo: "Organize the facts of a case",
			dominio: "analisis",
			tarea: ["ordenar-estructurar"],
			tecnica: ["estructurado"],
			sensibilidad: "contexto-sensible",
			tarea_que_resuelve: "Put the facts of a case in chronological order and suggest questions to complete it.",
			nota_reutilizacion: "Always use anonymized or fictitious data. Review the result with your professional judgment before using it.",
			bloques: ["no-inventar", "indicar-supuestos"],
			prompt: `Role: You are an assistant that helps organize case information.

Context: I have disorganized notes about a case. The data is anonymized: it contains no names or identity documents.

Task: Put the facts in chronological order and then suggest the questions that are missing to understand the case better.

Format: A timeline with date and fact, followed by a list of pending questions.

Constraints: Do not draw conclusions or make diagnoses; only organize and ask.

Notes:
{{notes}}`,
		},
		{
			titulo: "Plan a project in stages",
			dominio: "organizacion",
			tarea: ["planificar"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Break a goal into stages with deadlines and risks.",
			nota_reutilizacion: "Change the goal, the deadline and the resources. If you already have stages defined, paste them in the context.",
			bloques: ["pedir-aclaracion", "indicar-supuestos"],
			prompt: `Role: You are a person with experience in project management.

Context: My goal is {{goal}}. I have {{deadline|one month|Time available}} and I have {{resources|the usual resources|People, tools and budget}}.

Task: Propose a plan in stages to achieve the goal.

Format: A table with the columns "Stage", "What is done", "Deadline" and "Main risk".

Constraints: At most six stages. Prioritize the essentials.`,
		},
		{
			titulo: "Prepare a meeting agenda",
			dominio: "organizacion",
			tarea: ["planificar"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Prepare an agenda with times and goals for a meeting.",
			nota_reutilizacion: "Change the topic, the length and who attends. Add the points you already know must be covered.",
			bloques: ["tono-claro"],
			prompt: `Role: You are a person who facilitates work meetings.

Context: I have a meeting about {{topic}} lasting {{length|60 minutes}} with {{attendees|my team|Who takes part}}.

Task: Prepare the meeting agenda.

Format: A numbered list with the item, the time assigned and the expected outcome of each one. At the end, one line with the decisions that must be made.

Constraints: The times must add up to the total length.`,
		},
		{
			titulo: "Prioritize a task list",
			dominio: "organizacion",
			tarea: ["priorizar"],
			tecnica: ["estructurado"],
			sensibilidad: "general",
			tarea_que_resuelve: "Order a task list by urgency and importance.",
			nota_reutilizacion: "Paste your tasks and change the priority criterion if yours is different (for example, by impact).",
			bloques: ["pedir-aclaracion"],
			prompt: `Role: You are a person who helps organize work.

Context: I have these pending tasks and limited time. The priority criterion is: {{criterion|urgency and importance|How you decide what goes first}}.

Task: Order the tasks from highest to lowest priority.

Format: A numbered list. Next to each task, one sentence with the reason for its place.

Constraints: Do not add new tasks.

Tasks:
{{tasks}}`,
		},
	],

	metas: [
		{
			titulo: "Improve a prompt",
			tarea: ["diagnosticar"],
			tecnica: ["meta"],
			sensibilidad: "general",
			tarea_que_resuelve: "Ask an AI to review a prompt and propose an improved version.",
			nota_reutilizacion: "Paste your prompt in the variable and copy the result. Change only one element per iteration and check the result before accepting it.",
			bloques: [],
			prompt: `Role: You are an expert in designing instructions for AI assistants.

Context: Below is a prompt that I use and that does not give me the results I expect.

Task: Review the prompt against the five elements (role, context, task, format and constraints). Say which one is missing or weak and propose an improved version.

Format: First a diagnosis as a short list, then the improved prompt in a text block.

Constraints: Keep the original intent. Change only what is necessary and explain each change in one sentence.

Prompt to improve:
{{prompt}}`,
		},
		{
			titulo: "Turn an idea into a five-element prompt",
			tarea: ["ordenar-estructurar"],
			tecnica: ["meta"],
			sensibilidad: "general",
			tarea_que_resuelve: "Turn a loose idea into a prompt with role, context, task, format and constraints.",
			nota_reutilizacion: "Describe the idea in your own words. If the AI asks questions, answer them before using the resulting prompt.",
			bloques: ["pedir-aclaracion"],
			prompt: `Role: You are an expert in writing clear prompts.

Context: I have an idea of what I want to ask an AI, but I do not know how to write it.

Task: Turn my idea into a prompt with the five elements: role, context, task, format and constraints.

Format: The final prompt, with each element in a paragraph that starts with its name.

Constraints: Mark with \\{{name}} (double braces) the data that I must fill in each time I use it.

My idea:
{{idea}}`,
		},
		{
			titulo: "Create examples for a few-shot prompt",
			tarea: ["ideacion"],
			tecnica: ["meta"],
			sensibilidad: "general",
			tarea_que_resuelve: "Generate draft input and output examples to use in a few-shot prompt.",
			nota_reutilizacion: "Review and correct each example before saving it: the examples define what the AI will imitate. Use between two and five.",
			bloques: ["no-inventar"],
			prompt: `Role: You are an expert in preparing examples to teach an AI a task.

Context: I want a prompt that does the following: {{task}}.

Task: Write {{count|3|Between 2 and 5}} varied examples of input and of the ideal output.

Format: For each one, "Example N", then "Input:" and "Output:".

Constraints: The examples must be realistic, different from each other and have the same output shape. Use fictitious data.`,
		},
	],
};

export default en;
