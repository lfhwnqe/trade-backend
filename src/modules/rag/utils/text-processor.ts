/**
 * 文本处理工具类
 * 提供文档预处理、分块、清理等功能
 */

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
  startChar: number;
  endChar: number;
  metadata?: Record<string, any>;
}

export interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
  minChunkSize: number;
  maxChunkSize: number;
  preserveParagraphs: boolean;
  preserveSentences: boolean;
}

export class TextProcessor {
  private static readonly DEFAULT_CHUNK_SIZE = 1000;
  private static readonly DEFAULT_CHUNK_OVERLAP = 200;
  private static readonly DEFAULT_MIN_CHUNK_SIZE = 100;
  private static readonly DEFAULT_MAX_CHUNK_SIZE = 2000;

  /**
   * 清理和预处理文本内容
   */
  static cleanText(text: string): string {
    if (!text) return '';

    return text
      // 移除多余的空白字符
      .replace(/\s+/g, ' ')
      // 移除多余的换行符
      .replace(/\n\s*\n/g, '\n\n')
      // 移除行首行尾空格
      .replace(/^\s+|\s+$/gm, '')
      // 标准化引号
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // 移除不可见字符
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();
  }

  /**
   * 智能文本分块
   */
  static splitText(text: string, options?: Partial<ChunkingOptions>): TextChunk[] {
    const opts: ChunkingOptions = {
      chunkSize: options?.chunkSize || this.DEFAULT_CHUNK_SIZE,
      chunkOverlap: options?.chunkOverlap || this.DEFAULT_CHUNK_OVERLAP,
      minChunkSize: options?.minChunkSize || this.DEFAULT_MIN_CHUNK_SIZE,
      maxChunkSize: options?.maxChunkSize || this.DEFAULT_MAX_CHUNK_SIZE,
      preserveParagraphs: options?.preserveParagraphs ?? true,
      preserveSentences: options?.preserveSentences ?? true,
    };

    const cleanedText = this.cleanText(text);
    const chunks: TextChunk[] = [];

    if (cleanedText.length <= opts.chunkSize) {
      return [{
        content: cleanedText,
        index: 0,
        tokenCount: this.estimateTokenCount(cleanedText),
        startChar: 0,
        endChar: cleanedText.length,
      }];
    }

    let currentPosition = 0;
    let chunkIndex = 0;

    while (currentPosition < cleanedText.length) {
      const chunkStart = Math.max(0, currentPosition - opts.chunkOverlap);
      let chunkEnd = Math.min(cleanedText.length, chunkStart + opts.chunkSize);

      // 尝试在句子边界处分割
      if (opts.preserveSentences && chunkEnd < cleanedText.length) {
        const sentenceEnd = this.findSentenceEnd(cleanedText, chunkEnd);
        if (sentenceEnd > chunkStart + opts.minChunkSize) {
          chunkEnd = sentenceEnd;
        }
      }

      // 尝试在段落边界处分割
      if (opts.preserveParagraphs && chunkEnd < cleanedText.length) {
        const paragraphEnd = this.findParagraphEnd(cleanedText, chunkEnd);
        if (paragraphEnd > chunkStart + opts.minChunkSize && paragraphEnd <= chunkStart + opts.maxChunkSize) {
          chunkEnd = paragraphEnd;
        }
      }

      const chunkContent = cleanedText.slice(chunkStart, chunkEnd).trim();
      
      if (chunkContent.length >= opts.minChunkSize) {
        chunks.push({
          content: chunkContent,
          index: chunkIndex++,
          tokenCount: this.estimateTokenCount(chunkContent),
          startChar: chunkStart,
          endChar: chunkEnd,
        });
      }

      currentPosition = chunkEnd;
    }

    return chunks;
  }

  /**
   * 提取文档关键词
   */
  static extractKeywords(text: string, maxKeywords: number = 10): string[] {
    const cleanedText = this.cleanText(text.toLowerCase());
    
    // 移除停用词
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'were', 'will', 'with', 'the', '的', '了', '在', '是',
      '和', '与', '或', '但', '因为', '所以', '如果', '那么', '这个', '那个'
    ]);

    const words = cleanedText
      .match(/\b\w+\b/g) || []
      .filter(word => word.length > 2 && !stopWords.has(word));

    // 计算词频
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // 按频率排序并返回前N个
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }

  /**
   * 生成文档摘要
   */
  static generateSummary(text: string, maxSentences: number = 3): string {
    const sentences = this.splitIntoSentences(text);
    
    if (sentences.length <= maxSentences) {
      return sentences.join(' ');
    }

    // 简单的摘要算法：选择包含关键词最多的句子
    const keywords = this.extractKeywords(text, 20);
    const sentenceScores = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const score = keywords.reduce((acc, keyword) => {
        return acc + (lowerSentence.includes(keyword) ? 1 : 0);
      }, 0);
      return { sentence, score };
    });

    return sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .map(item => item.sentence)
      .join(' ');
  }

  /**
   * 估算 token 数量
   */
  static estimateTokenCount(text: string): number {
    if (!text) return 0;
    
    // 简化的 token 估算：平均每4个字符对应1个 token
    // 中文字符通常每个字符对应1个 token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    
    return Math.ceil(chineseChars + otherChars / 4);
  }

  /**
   * 检测文档语言
   */
  static detectLanguage(text: string): 'zh' | 'en' | 'mixed' | 'unknown' {
    if (!text) return 'unknown';

    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = chineseChars + englishChars;

    if (totalChars === 0) return 'unknown';

    const chineseRatio = chineseChars / totalChars;
    const englishRatio = englishChars / totalChars;

    if (chineseRatio > 0.7) return 'zh';
    if (englishRatio > 0.7) return 'en';
    if (chineseRatio > 0.2 && englishRatio > 0.2) return 'mixed';
    
    return 'unknown';
  }

  /**
   * 提取文档结构
   */
  static extractDocumentStructure(text: string): {
    title?: string;
    sections: { title: string; content: string; level: number }[];
    hasTable: boolean;
    hasList: boolean;
    hasCode: boolean;
  } {
    const lines = text.split('\n');
    const sections: { title: string; content: string; level: number }[] = [];
    let currentSection: { title: string; content: string; level: number } | null = null;

    // 检测标题模式
    const titlePatterns = [
      /^#{1,6}\s+(.+)$/,           // Markdown 标题
      /^(\d+\.)\s+(.+)$/,         // 数字标题
      /^([一二三四五六七八九十]+[、.])\s*(.+)$/,  // 中文数字标题
    ];

    let documentTitle: string | undefined;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 检测是否为标题
      let isTitle = false;
      let titleLevel = 0;
      let titleText = '';

      for (const pattern of titlePatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          isTitle = true;
          titleLevel = pattern === titlePatterns[0] ? 
            (match[0].match(/^#+/) || [''])[0].length : 1;
          titleText = match[match.length - 1];
          break;
        }
      }

      // 如果没有文档标题，且是第一级标题，设为文档标题
      if (isTitle && titleLevel === 1 && !documentTitle) {
        documentTitle = titleText;
      }

      if (isTitle) {
        // 保存当前章节
        if (currentSection) {
          sections.push(currentSection);
        }
        // 开始新章节
        currentSection = {
          title: titleText,
          content: '',
          level: titleLevel,
        };
      } else if (currentSection) {
        // 添加内容到当前章节
        currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
      } else {
        // 没有章节时，创建默认章节
        if (!currentSection) {
          currentSection = {
            title: '正文',
            content: trimmedLine,
            level: 1,
          };
        } else {
          currentSection.content += '\n' + trimmedLine;
        }
      }
    }

    // 添加最后一个章节
    if (currentSection) {
      sections.push(currentSection);
    }

    return {
      title: documentTitle,
      sections,
      hasTable: /\|.*\|/.test(text),
      hasList: /^[\s]*[-*+]\s+/m.test(text),
      hasCode: /```|`[^`]+`/.test(text),
    };
  }

  // 私有辅助方法

  private static findSentenceEnd(text: string, startPos: number): number {
    const sentenceEnders = /[.!?。！？]/g;
    sentenceEnders.lastIndex = startPos;
    
    const match = sentenceEnders.exec(text);
    return match ? match.index + 1 : startPos;
  }

  private static findParagraphEnd(text: string, startPos: number): number {
    const paragraphEnd = text.indexOf('\n\n', startPos);
    return paragraphEnd > -1 ? paragraphEnd : startPos;
  }

  private static splitIntoSentences(text: string): string[] {
    // 简单的句子分割
    return text
      .split(/[.!?。！？]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}