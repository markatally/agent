import { describe, expect, it } from 'bun:test';
import { answerVideoQueryFromTranscript } from '../../apps/api/src/services/transcript-qa';

function createMockLlm(options?: {
  content?: string;
  embed?: (texts: string[]) => number[][];
}) {
  return {
    async *streamChat() {
      yield { type: 'content' as const, content: options?.content || '基于证据可知，视频讲了 Skill 的三层机制 [E1] [E2]' };
      yield { type: 'done' as const };
    },
    async embedTexts(texts: string[]) {
      if (options?.embed) return options.embed(texts);
      return texts.map((text) => {
        const v = new Array<number>(16).fill(0);
        for (let i = 0; i < text.length; i += 1) {
          v[i % v.length] += (text.charCodeAt(i) % 31) / 31;
        }
        return v;
      });
    },
  };
}

function createSequencedMockLlm(responses: string[]) {
  let i = 0;
  return {
    async *streamChat() {
      const content = responses[Math.min(i, responses.length - 1)] || '';
      i += 1;
      if (content) yield { type: 'content' as const, content };
      yield { type: 'done' as const };
    },
    async embedTexts(texts: string[]) {
      return texts.map((text) => {
        const v = new Array<number>(16).fill(0);
        for (let idx = 0; idx < text.length; idx += 1) {
          v[idx % v.length] += (text.charCodeAt(idx) % 29) / 29;
        }
        return v;
      });
    },
  };
}

describe('Transcript QA Engine', () => {
  it('answers time-range questions from transcript evidence', async () => {
    const transcript = [
      '[00:08:30.670 --> 00:08:34.130] 完全的去理解它整个的一个交互的一个过程了',
      '[00:08:39.299 --> 00:08:40.970] 其实这个代码并不难',
      '[00:08:45.770 --> 00:08:47.670] 然后我们定义了一些工具',
      '[00:09:03.390 --> 00:09:05.070] 第二个是bash',
    ].join('\n');

    const result = await answerVideoQueryFromTranscript({
      llm: createMockLlm(),
      userQuery: '视频8分30秒到9分05秒讲了啥',
      transcriptText: transcript,
    });

    expect(result.status).toBe('answered');
    expect(result.content).toContain('08:30-09:05');
    expect(result.content).toContain('[00:08:30.670 --> 00:08:34.130]');
    expect(result.content).toContain('[00:09:03.390 --> 00:09:05.070]');
  });

  it('returns insufficient-evidence for unrelated follow-up questions', async () => {
    const transcript = [
      '[00:00:00.040 --> 00:00:01.560] 最近skill真的特别火',
      '[00:05:29.619 --> 00:05:31.499] 一步一步的把我们这个项目跑起来',
    ].join('\n');

    const result = await answerVideoQueryFromTranscript({
      llm: createMockLlm(),
      userQuery: '这个视频里讲了摩斯密码和二进制吗？',
      transcriptText: transcript,
    });

    expect(result.status).toBe('insufficient_evidence');
    expect(result.content).toContain('transcript');
  });

  it('supports summary query with timeline evidence coverage', async () => {
    const transcript = [
      '[00:00:00.040 --> 00:00:01.560] 最近skill真的特别火',
      '[00:01:23.450 --> 00:01:29.640] 第一层启动扫描 第二层触发加载 第三层执行',
      '[00:05:29.619 --> 00:05:31.499] 一步一步的把我们这个项目跑起来',
      '[00:10:03.670 --> 00:10:04.430] 做工具调用',
      '[00:12:40.900 --> 00:12:41.820] 拜拜拜拜',
    ].join('\n');

    const result = await answerVideoQueryFromTranscript({
      llm: createMockLlm({
        content:
          '视频先介绍了 Skill 的核心价值，再解释了三层加载机制，并在后半段演示了项目跑通与工具调用流程 [E1] [E3] [E4]',
      }),
      userQuery: '请给我一个更详细的总结',
      transcriptText: transcript,
    });

    expect(result.status).toBe('answered');
    expect(result.content).toContain('[E');
    expect(result.evidence.length).toBeGreaterThan(3);
  });

  it('treats broad overview follow-up phrasing as summary intent', async () => {
    const transcript = [
      '[00:00:00.040 --> 00:00:01.560] Recently, skills have been really trending',
      '[00:01:23.450 --> 00:01:29.640] The first layer triggers on startup, second on demand, third at execution',
      '[00:05:29.619 --> 00:05:31.499] We run the project step by step',
      '[00:10:03.670 --> 00:10:04.430] perform tool invocation',
      '[00:12:40.900 --> 00:12:41.820] Bye bye',
    ].join('\n');

    const result = await answerVideoQueryFromTranscript({
      llm: createMockLlm({
        content: '',
      }),
      userQuery: '介绍这个视频的重点内容',
      transcriptText: transcript,
    });

    expect(result.status).toBe('answered');
    expect(result.content).toContain('重点');
    expect(result.content).toContain('[E');
    expect(result.content).not.toContain('缺少足够证据');
  });

  it('supports first-third scoped summary queries', async () => {
    const transcript = [
      '[00:00:00.000 --> 00:00:15.000] 开场介绍今天要讲 Skill 的背景',
      '[00:00:15.000 --> 00:00:30.000] 解释为什么 Skill 机制最近很火',
      '[00:00:30.000 --> 00:00:45.000] 讲解启动阶段的扫描与加载',
      '[00:00:45.000 --> 00:01:00.000] 中段开始演示项目代码结构',
      '[00:01:00.000 --> 00:01:15.000] 后段讲解工具调用与调试',
      '[00:01:15.000 --> 00:01:30.000] 结尾总结与致谢',
    ].join('\n');

    const result = await answerVideoQueryFromTranscript({
      llm: createMockLlm({ content: '' }),
      userQuery: '视频前1/3重点讲了什么内容',
      transcriptText: transcript,
    });

    expect(result.status).toBe('answered');
    expect(result.content).toContain('这一段的重点');
    expect(result.content).not.toContain('后段讲解工具调用与调试');
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.every((item) => item.startSeconds <= 30)).toBe(true);
  });

  it('handles latter-half follow-up phrasing and rejects off-topic llm drafts', async () => {
    const transcript = [
      '[00:00:00.000 --> 00:00:10.000] 前半段先讲 skill 背景',
      '[00:00:10.000 --> 00:00:20.000] 前半段解释三层加载定义',
      '[00:00:20.000 --> 00:00:30.000] 后半段演示如何跑项目与安装依赖',
      '[00:00:30.000 --> 00:00:40.000] 后半段讲解环境变量和 key 配置',
    ].join('\n');

    const result = await answerVideoQueryFromTranscript({
      llm: createMockLlm({
        content:
          'The image shows a fluffy cat with long fur and a curious expression on a dark background.',
      }),
      userQuery: '后面1/2讲了啥',
      transcriptText: transcript,
    });

    expect(result.status).toBe('answered');
    expect(result.content).toContain('00:20-00:40');
    expect(result.content).toContain('后半段演示如何跑项目与安装依赖');
    expect(result.content).toContain('后半段讲解环境变量和 key 配置');
    expect(result.content).not.toContain('fluffy cat');
  });

  it('uses llm-first understanding for ambiguous segmented follow-up phrasing', async () => {
    const transcript = [
      '[00:00:00.000 --> 00:00:10.000] 前段讲背景',
      '[00:00:10.000 --> 00:00:20.000] 前段讲基础概念',
      '[00:00:20.000 --> 00:00:30.000] 后段讲项目实操',
      '[00:00:30.000 --> 00:00:40.000] 后段讲调试与部署',
    ].join('\n');

    const result = await answerVideoQueryFromTranscript({
      llm: createSequencedMockLlm([
        '{"intent":"time_range","range":{"type":"relative","anchor":"tail","numerator":1,"denominator":2},"language":"zh"}',
      ]),
      userQuery: '最后一半讲了啥',
      transcriptText: transcript,
    });

    expect(result.status).toBe('answered');
    expect(result.content).toContain('00:20-00:40');
    expect(result.content).toContain('后段讲项目实操');
    expect(result.content).toContain('后段讲调试与部署');
  });
});
