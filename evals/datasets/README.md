# Evaluation Datasets

This directory contains evaluation datasets for prompt testing and comparison.

## Dataset Structure

Datasets are organized by category and use a standardized JSON format:

```json
{
  "name": "Dataset Name",
  "description": "Brief description of what this dataset tests",
  "category": "chat|rag|agent|technical|reasoning",
  "version": "1.0.0",
  "created_at": "2024-01-01T00:00:00Z",
  "tests": [
    {
      "description": "Human-readable description of the test case",
      "vars": {
        "variable_name": "value",
        "context": "Background context for the prompt",
        "user_query": "The actual user input"
      },
      "assert": [
        {
          "type": "javascript|model-graded-closedqa|model-graded-openqa|llm-rubric",
          "value": "Assertion logic or grading prompt"
        }
      ],
      "metadata": {
        "difficulty": "easy|medium|hard",
        "tags": ["tag1", "tag2"],
        "expected_behavior": "What a good response should contain"
      }
    }
  ]
}
```

## Dataset Categories

### 1. Chat Prompts (`chat/`)

- Basic conversation scenarios
- Common user interactions
- Response quality and helpfulness

### 2. RAG Enhancement (`rag/`)

- Context-aware responses
- Document synthesis
- Information retrieval accuracy

### 3. Agent Tool Use (`agent/`)

- Multi-step reasoning
- Tool selection and execution
- Complex problem solving

### 4. Technical Tasks (`technical/`)

- Code generation and explanation
- Technical documentation
- System design and architecture

### 5. Reasoning (`reasoning/`)

- Logical deduction
- Mathematical problems
- Analytical thinking

## Assertion Types

### JavaScript Assertions

Direct code evaluation of the output:

```json
{
  "type": "javascript",
  "value": "output.toLowerCase().includes('hello')"
}
```

### Model-Graded Closed QA

Binary yes/no questions evaluated by a model:

```json
{
  "type": "model-graded-closedqa",
  "value": "Does the response accurately answer the user's question?"
}
```

### Model-Graded Open QA

Open-ended evaluation with scoring:

```json
{
  "type": "model-graded-openqa",
  "value": "Rate the helpfulness of this response from 1-10"
}
```

### LLM Rubric

Multi-criteria evaluation:

```json
{
  "type": "llm-rubric",
  "value": "Evaluate accuracy, completeness, and clarity"
}
```

## Best Practices

### Test Design

- **Clear descriptions**: Each test should have a human-readable purpose
- **Realistic scenarios**: Use actual user queries and contexts
- **Comprehensive coverage**: Test edge cases and common use cases
- **Balanced difficulty**: Mix of easy, medium, and hard tests

### Variable Naming

- Use descriptive variable names: `user_query`, `context`, `domain_knowledge`
- Keep variables consistent across tests in the same dataset
- Provide meaningful default values

### Assertions

- Test both content and format requirements
- Include multiple assertion types for robust evaluation
- Focus on measurable, objective criteria
- Avoid overly subjective evaluations

### Metadata

- Tag tests with relevant categories and difficulty levels
- Include expected behavior descriptions
- Track test creation and modification dates

## Dataset Management

### Version Control

- Use semantic versioning for datasets
- Document changes between versions
- Maintain backward compatibility when possible

### Quality Assurance

- Review tests for clarity and accuracy
- Validate JSON syntax
- Test assertions before adding to main dataset

### Organization

- Group related tests in logical categories
- Use consistent naming conventions
- Provide clear documentation

## Sample Datasets

See the individual category directories for example datasets:

- `chat/basic-conversations.json` - Common chat scenarios
- `rag/context-awareness.json` - RAG context utilization
- `agent/tool-selection.json` - Agent tool use reasoning
- `technical/code-explanation.json` - Code comprehension
- `reasoning/logical-problems.json` - Logical deduction

## Contributing

When adding new datasets:

1. Choose the appropriate category directory
2. Follow the standard JSON structure
3. Include comprehensive assertions
4. Add clear documentation
5. Test with multiple prompts
6. Update this README if adding new categories

## Usage

Datasets are automatically loaded by the evaluation scripts. To use a specific dataset:

```bash
tsx run-promptfoo.ts --datasets "chat/basic-conversations,rag/context-awareness"
```

Or reference specific datasets in your Promptfoo configuration.
