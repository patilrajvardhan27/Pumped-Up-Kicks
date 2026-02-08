'use client';

import { useState } from 'react';
import { chatService } from '@/services';
import type { ChatResponse } from '@/types/api';
import Button from './Button';
import Input from './Input';
import Alert from './Alert';

export default function ChatInterface() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await chatService.query({ question, top_k: 5 });
      setResponse(result);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="card">
        <h2 className="text-3xl font-bold text-charcoal-champion mb-6">
          Ask a Question 💬
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Your Question"
            placeholder="What would you like to know about your lectures?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading || !question.trim()}
            className="w-full"
          >
            {loading ? 'Thinking...' : 'Ask Question'}
          </Button>
        </form>

        {error && (
          <div className="mt-6">
            <Alert variant="error" title="Error">
              {error}
            </Alert>
          </div>
        )}

        {response && (
          <div className="mt-8 space-y-4">
            <div className="bg-ocean-breeze border-l-4 border-sky-diver p-6 rounded">
              <h3 className="font-bold text-deep-dive mb-2">Answer</h3>
              <p className="text-midnight-mystery whitespace-pre-wrap">{response.answer}</p>
              <div className="mt-4 text-sm text-storm-cloud">
                Response time: {response.response_time.toFixed(2)}s • Sources: {response.num_sources}
              </div>
            </div>

            {response.sources.length > 0 && (
              <div>
                <h4 className="font-bold text-midnight-mystery mb-3">Sources</h4>
                <div className="space-y-2">
                  {response.sources.map((source, idx) => (
                    <div key={idx} className="bg-foggy-morning p-4 rounded border border-silver-lining">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-electric-blueberry">{source.video}</span>
                        <span className="text-sm text-slate-skate">{source.timestamp}</span>
                      </div>
                      <p className="text-sm text-storm-cloud">{source.text}</p>
                      {source.similarity && (
                        <span className="text-xs text-slate-skate mt-1 block">
                          Relevance: {(source.similarity * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
