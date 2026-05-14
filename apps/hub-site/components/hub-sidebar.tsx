'use client'

import { LogOut, Receipt, LayoutGrid, Home, Zap } from 'lucide-react'
import Link from 'next/link'

type NavItem = {
    label: string
    icon: React.ReactNode
    href?: string
    active?: boolean
    onClick?: () => void
    danger?: boolean
}

type HubSidebarProps = {
    userName: string
    onLogout: () => void
    activePage?: 'hub' | 'purchases'
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
}

export function HubSidebar({
    userName,
    onLogout,
    activePage = 'hub',
}: HubSidebarProps) {
    const navMain: NavItem[] = [
        {
            label: 'Hub principal',
            icon: <LayoutGrid size={18} />,
            href: '/hub',
            active: activePage === 'hub',
        },
    ]

    const navAccount: NavItem[] = [
        {
            label: 'Tati AI',
            icon: <Home size={18} />,
            href: '/',
        },
    ]

    return (
        <aside className="hidden md:flex w-[260px] min-h-screen flex-col border-r border-white/10 bg-gradient-to-b from-[#140f24] via-[#120f1d] to-[#09090b] backdrop-blur-xl">
            <div className="border-b border-white/10 px-6 py-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-400 shadow-[0_0_25px_rgba(139,92,246,0.35)]">
                        <img src="/images/tati_logo.jpg" alt="Tati AI" />
                    </div>

                    <div>
                        <p className="text-[15px] font-semibold tracking-tight text-white">
                            Tati's Hub
                        </p>
                        <p className="text-xs text-zinc-500">
                            Premium Platform
                        </p>
                    </div>
                </div>
            </div>

            <div className="px-6 py-5">
                <div className="flex items-center gap-3 rounded-2xl border border-violet-500/10 bg-white/[0.03] p-3 backdrop-blur-md">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-sm font-bold text-white shadow-lg shadow-violet-900/40">
                        {getInitials(userName)}
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">
                            {userName}
                        </p>
                        <p className="text-xs text-violet-300/70">
                            Membro Premium
                        </p>
                    </div>
                </div>
            </div>

            <nav className="flex flex-1 flex-col px-4 py-2">
                <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Navegação
                </div>

                <div className="space-y-2">
                    {navMain.map((item) =>
                        item.href ? (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${item.active
                                        ? 'bg-violet-600/20 text-violet-300 shadow-[0_0_25px_rgba(139,92,246,0.18)] border border-violet-500/20'
                                        : 'border border-transparent text-zinc-400 hover:border-violet-500/10 hover:bg-violet-500/10 hover:text-white'
                                    }`}
                            >
                                {item.active && (
                                    <div className="absolute left-0 top-3 h-8 w-1 rounded-r-full bg-violet-400" />
                                )}

                                <span className="relative z-10">{item.icon}</span>
                                <span className="relative z-10">{item.label}</span>
                            </Link>
                        ) : null,
                    )}
                </div>

                <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                
            </nav>

            <div className="border-t border-white/10 p-4">
                <button
                    onClick={onLogout}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-500/10 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-300 transition-all duration-200 hover:bg-red-500/10 hover:text-red-200"
                >
                    <LogOut size={17} />
                    Sair
                </button>
            </div>
        </aside>
    )
}