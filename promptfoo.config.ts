/**
 * Promptfoo Configuration
 * 
 * Configuration for prompt evaluation using Promptfoo.
 * Supports multiple providers, test cases, and evaluation metrics.
 */

import type { Config } from 'promptfoo'

const config: Config = {
  // Shared configuration
  description: 'Command Center Prompt Evaluation Suite',
  
  // Providers to test against
  providers: [
    {
      id: 'ollama:llama3.1',
      label: 'Ollama - Llama 3.1 8B',
      // Use the local Ollama instance
      apiBaseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.1:8b',
      config: {
        temperature: 0.7,
        maxTokens: 2048,
      },
    },
    {
      id: 'ollama:llama3.1:70b',
      label: 'Ollama - Llama 3.1 70B',
      apiBaseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.1:70b',
      config: {
        temperature: 0.7,
        maxTokens: 4096,
      },
    },
    {
      id: 'ollama:qwen2.5',
      label: 'Ollama - Qwen2.5 7B',
      apiBaseUrl: 'http://127.0.0.1:11434',
      model: 'qwen2.5:7b',
      config: {
        temperature: 0.7,
        maxTokens: 2048,
      },
    },
  ],

  // Test datasets
  datasets: [
    {
      name: 'Basic Chat Prompts',
      description: 'Fundamental conversation and assistance tasks',
      tests: [
        {
          description: 'Simple greeting response',
          vars: {
            user_query: 'Hello! How are you today?',
            context: 'A friendly conversation starter',
          },
          assert: [
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("hello") || output.toLowerCase().includes("hi")',
            },
            {
              type: 'javascript', 
              value: 'output.length > 10 && output.length < 500',
            },
          ],
        },
        {
          description: 'Code explanation request',
          vars: {
            user_query: 'Can you explain what this Python code does? def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)',
            context: 'User is learning programming and needs help understanding recursive functions',
          },
          assert: [
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("fibonacci")',
            },
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("recurs")',
            },
            {
              type: 'model-graded-closedqa',
              value: 'Does the explanation accurately describe what the Fibonacci sequence is and how the code calculates it?',
            },
          ],
        },
        {
          description: 'Technical documentation help',
          vars: {
            user_query: 'Write documentation for a REST API endpoint that creates a user',
            context: 'Building a user management system with Node.js and Express',
          },
          assert: [
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("post") || output.toLowerCase().includes("create")',
            },
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("api")',
            },
            {
              type: 'model-graded-closedqa',
              value: 'Does the documentation include HTTP method, endpoint path, request body, and response format?',
            },
          ],
        },
      ],
    },
    {
      name: 'RAG Enhancement Prompts',
      description: 'Retrieval-augmented generation scenarios',
      tests: [
        {
          description: 'Context-aware response',
          vars: {
            user_query: 'What are the key features of our product?',
            context: 'Our product is a local AI command center with chat, RAG, and agent capabilities. It supports Ollama integration, prompt management, and tool execution.',
          },
          assert: [
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("command center") || output.toLowerCase().includes("ai")',
            },
            {
              type: 'model-graded-closedqa',
              value: 'Does the response accurately reference the provided context about the command center features?',
            },
          ],
        },
        {
          description: 'Document synthesis',
          vars: {
            user_query: 'Summarize the main points from these documents about database optimization',
            context: 'Document 1: Use indexes for frequently queried columns. Document 2: Consider connection pooling for high traffic. Document 3: Implement read replicas for scaling reads.',
          },
          assert: [
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("index")',
            },
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("pool") || output.toLowerCase().includes("replica")',
            },
            {
              type: 'model-graded-closedqa',
              value: 'Does the summary capture all three main optimization techniques mentioned?',
            },
          ],
        },
      ],
    },
    {
      name: 'Agent Tool Use Prompts',
      description: 'Scenarios requiring tool execution and reasoning',
      tests: [
        {
          description: 'File operations',
          vars: {
            user_query: 'Read the contents of config.json and show me the database settings',
            context: 'Working with application configuration files',
          },
          assert: [
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("config") || output.toLowerCase().includes("database")',
            },
            {
              type: 'model-graded-closedqa',
              value: 'Does the response indicate understanding of file reading operations?',
            },
          ],
        },
        {
          description: 'Multi-step reasoning',
          vars: {
            user_query: 'Check the system metrics and if CPU usage is above 80%, alert the admin',
            context: 'System monitoring and alerting workflow',
          },
          assert: [
            {
              type: 'javascript',
              value: 'output.toLowerCase().includes("cpu") || output.toLowerCase().includes("metrics")',
            },
            {
              type: 'model-graded-closedqa',
              value: 'Does the response show understanding of conditional logic and alerting?',
            },
          ],
        },
      ],
    },
  ],

  // Prompt templates to evaluate
  prompts: [
    {
      label: 'Default Assistant',
      prompt: 'You are a helpful AI assistant. {{context}}\n\n{{user_query}}\n\nPlease provide a detailed and accurate response.',
    },
    {
      label: 'Technical Expert',
      prompt: 'You are a technical expert with deep knowledge of software development, systems architecture, and programming. {{context}}\n\n{{user_query}}\n\nProvide a technically accurate and detailed response, including code examples when relevant.',
    },
    {
      label: 'Concise Assistant',
      prompt: 'You are a helpful AI assistant who provides clear, concise responses. {{context}}\n\n{{user_query}}\n\nGive a brief but complete answer.',
    },
    {
      label: 'RAG-Enhanced',
      prompt: 'You are an AI assistant with access to contextual information. Use the provided context to inform your response, but also draw on your general knowledge when helpful. {{context}}\n\n{{user_query}}\n\nProvide a comprehensive response that leverages the context.',
    },
    {
      label: 'Agent-Ready',
      prompt: 'You are an AI agent capable of using tools and executing multi-step reasoning. {{context}}\n\n{{user_query}}\n\nThink step by step and indicate what tools or actions you would take to address this request.',
    },
  ],

  // Evaluation configuration
  outputPath: './eval-results',
  maxConcurrency: 3,
  repeat: 1,
  passRate: 0.8,

  // Scoring and evaluation
  scoring: {
    default: {
      rubric: [
        {
          name: 'relevance',
          description: 'Response relevance to the query',
          weight: 0.3,
        },
        {
          name: 'accuracy', 
          description: 'Factual accuracy of the response',
          weight: 0.3,
        },
        {
          name: 'completeness',
          description: 'Thoroughness of the response',
          weight: 0.2,
        },
        {
          name: 'clarity',
          description: 'Clarity and readability',
          weight: 0.2,
        },
      ],
    },
  },

  // Output configuration
  outputOptions: {
    path: './eval-results',
    format: ['json', 'csv', 'html'],
    includePrompts: true,
    includeProviderInfo: true,
  },
}

export default config
