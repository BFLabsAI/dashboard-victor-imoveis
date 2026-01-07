
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Menu, X, Settings, LogOut, Bell, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface LayoutProps {
    children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const location = useLocation();

    const navigation = [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Atendimentos', href: '/chat', icon: MessageSquare },
        { name: 'Configurações', href: '/settings', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-navy-900 flex font-sans overflow-hidden">
            {/* Mobile sidebar backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-navy-900/80 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Boxed Style */}
            <div className={clsx(
                "fixed inset-y-0 left-0 z-50 w-72 bg-navy-800 border-r border-navy-700 transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto lg:flex lg:flex-col lg:my-4 lg:ml-4 lg:rounded-3xl lg:border lg:shadow-2xl",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Logo Area */}
                <div className="flex items-center justify-between h-24 px-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-navy-700 flex items-center justify-center shadow-lg border border-navy-600">
                            <img
                                src="/logo.jpg"
                                alt="Odonto Solluti"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-100 tracking-tight leading-none">Odonto Solluti</h1>
                            <span className="text-xs text-neon-blue font-medium tracking-widest uppercase">Odontologia</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="lg:hidden p-1 rounded-md text-slate-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-2">
                    <div className="px-4 mb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Menu</div>
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={clsx(
                                    "flex items-center justify-between px-5 py-4 text-sm font-medium rounded-2xl transition-all duration-300 group relative overflow-hidden",
                                    isActive
                                        ? "text-navy-900 bg-gradient-to-r from-neon-blue to-blue-400 shadow-neon"
                                        : "text-slate-400 hover:text-white hover:bg-navy-700"
                                )}
                            >
                                <div className="flex items-center gap-3 relative z-10">
                                    <Icon className={clsx("h-5 w-5 transition-colors", isActive ? "text-navy-900" : "text-slate-400 group-hover:text-neon-blue")} />
                                    {item.name}
                                </div>
                                {isActive && <ChevronRight size={16} className="text-navy-900" />}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Profile */}
                <div className="p-4 mt-auto">
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-navy-900/50 border border-navy-700">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-md ring-2 ring-navy-800">
                            DA
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">Odonto Solluti</p>
                            <p className="text-xs text-slate-400 truncate">Online</p>
                        </div>
                        <LogOut size={18} className="text-slate-500 hover:text-neon-blue cursor-pointer transition-colors" />
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Top Header */}
                <header className="h-24 flex items-center justify-between px-8 lg:px-12">
                    <div className="flex items-center">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2 -ml-2 text-slate-400 rounded-md hover:text-white mr-4"
                        >
                            <Menu size={24} />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                {navigation.find(n => n.href === location.pathname)?.name || 'Dashboard'}
                            </h2>
                            <p className="text-sm text-slate-400">Bem-vindo ao Odonto Solluti</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-navy-800 rounded-full border border-navy-700">
                            <span className="w-2 h-2 rounded-full bg-neon-blue animate-pulse"></span>
                            <span className="text-xs font-medium text-neon-blue">Sistema Operacional</span>
                        </div>
                        <button className="p-3 bg-navy-800 rounded-full text-slate-400 hover:text-neon-blue hover:bg-navy-700 transition-all relative border border-navy-700">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-pink-500 rounded-full border-2 border-navy-800"></span>
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto px-4 pb-4 lg:px-8 lg:pb-8 scroll-smooth">
                    <div className="max-w-7xl mx-auto h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

