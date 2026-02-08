'use client';

import { useState } from 'react';
import { ChatInterface, VideoUpload, VideoList, ServerStatus } from '@/components';
import Link from 'next/link';

export default function AppPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-cloud-nine">
      <header className="bg-snowflake-surprise border-b border-silver-lining">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold text-electric-blueberry cursor-pointer hover:text-soft-serve transition-colors">
              Pumped Up Kicks
            </h1>
          </Link>
          <div className="flex items-center gap-4">
            <ServerStatus />
            <Link href="/">
              <button className="text-storm-cloud hover:text-electric-blueberry transition-colors">
                Home
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        <section>
          <ChatInterface />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <VideoUpload onUploadSuccess={handleUploadSuccess} />
          </div>
          <div>
            <VideoList refreshTrigger={refreshTrigger} />
          </div>
        </section>

        <section className="card bg-gradient-to-r from-electric-blueberry to-lavender-latte text-snowflake-surprise">
          <h3 className="text-2xl font-bold mb-4">How to Use</h3>
          <div className="space-y-3 text-ocean-breeze">
            <p><strong className="text-snowflake-surprise">1. Upload a Video:</strong> Use the upload form to add lecture videos (MP4, AVI, MOV, MKV)</p>
            <p><strong className="text-snowflake-surprise">2. Ask Questions:</strong> Use the chat interface to ask questions about any topic</p>
            <p><strong className="text-snowflake-surprise">3. Get Answers:</strong> The AI will analyze your lectures and provide intelligent responses</p>
          </div>
        </section>
      </main>
    </div>
  );
}
