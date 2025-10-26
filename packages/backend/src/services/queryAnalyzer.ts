import { getLLM } from '../config/llm';
import { logger } from '../utils/logger';

const TABLE_DETECTION_PROMPT = `You are a SQL expert. Extract all table names from the following SQL query.
Return ONLY a JSON array of table names, nothing else.

Query: {query}

Example response: ["users", "orders", "products"]`;

export async function extractTableNames(query: string): Promise<string[]> {
  try {
    const llm = getLLM();
    const prompt = TABLE_DETECTION_PROMPT.replace('{query}', query);
    
    logger.debug('Extracting table names from query');
    const response = await llm.invoke(prompt);
    
    // Parse LLM response
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```\n?/g, '').trim();
    }
    
    const tables: string[] = JSON.parse(jsonContent);
    
    if (!Array.isArray(tables)) {
      throw new Error('Expected array of table names');
    }
    
    logger.info(`Extracted ${tables.length} tables:`, tables);
    
    return tables;
  } catch (error) {
    logger.error('Table extraction failed:', error);
    
    // Fallback: try basic regex extraction
    const tablePattern = /(?:FROM|JOIN)\s+`?(\w+)`?/gi;
    const matches = [...query.matchAll(tablePattern)];
    const tables = matches.map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i);
    
    logger.warn('Using fallback regex extraction:', tables);
    return tables;
  }
}

