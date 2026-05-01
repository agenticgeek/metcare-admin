'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UsersTab } from '@/components/UsersTab';
import { VideosTab } from '@/components/VideosTab';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'users' | 'videos'>('users');

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-beige-skin/50 pb-px">
        <button
          onClick={() => setActiveTab('users')}
          className={`
            px-6 py-3 text-sm font-semibold rounded-t-xl transition-all
            ${activeTab === 'users'
              ? 'bg-white text-silver-blue border-t border-l border-r border-card-border shadow-[0_4px_0_0_white]'
              : 'text-muted-fg hover:text-cherry-brown hover:bg-white/50'
            }
          `}
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          {t('nav.users')}
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`
            px-6 py-3 text-sm font-semibold rounded-t-xl transition-all
            ${activeTab === 'videos'
              ? 'bg-white text-silver-blue border-t border-l border-r border-card-border shadow-[0_4px_0_0_white]'
              : 'text-muted-fg hover:text-cherry-brown hover:bg-white/50'
            }
          `}
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          {t('nav.videos')}
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-card-border p-6 shadow-sm min-h-[500px]">
        {activeTab === 'users' ? <UsersTab /> : <VideosTab />}
      </div>
    </div>
  );
}
