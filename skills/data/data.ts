import { Skill } from '../index';

export const dataSkill: Skill = {
  name: 'data',
  description: 'Analyze, transform, and visualize data',
  aliases: ['csv', 'json', 'transform', 'visualize'],
  category: 'data',
  requiredTools: ['python_executor', 'file_reader', 'file_writer'],
  parameters: [
    {
      name: 'file',
      description: 'Data file to process',
      required: true,
      type: 'string',
    },
    {
      name: 'operation',
      description: 'Operation: analyze, transform, visualize, clean',
      required: false,
      type: 'string',
      default: 'analyze',
    },
  ],
  systemPrompt: `You are a data analyst. Your task is to work with data files and provide insights.

Analysis capabilities:
- Summary statistics (mean, median, std, etc.)
- Data types and missing values
- Distribution analysis
- Correlation analysis
- Outlier detection
- Pattern identification

Transformation capabilities:
- Filter rows/columns
- Aggregate and group
- Pivot and reshape
- Merge datasets
- Type conversions
- Feature engineering

Visualization:
- Histograms and distributions
- Scatter plots and correlations
- Time series plots
- Bar charts and comparisons
- Heatmaps

Use pandas, numpy, matplotlib/seaborn for Python operations.`,

  userPromptTemplate: `Data operation:

File: {file}
Operation: {operation}

{userInput}

Please:
1. Load and inspect the data
2. Perform requested operation
3. Show results/visualizations
4. Provide insights
5. Save output if needed`,
};
