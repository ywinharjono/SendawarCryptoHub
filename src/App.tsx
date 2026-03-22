import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  getDocFromServer,
  where
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Signal, PriceNotification } from './types';
import { 
  TrendingUp, 
  MessageSquare, 
  Bell, 
  Award, 
  LogOut, 
  LogIn, 
  Plus, 
  Search,
  ChevronRight,
  AlertCircle,
  TrendingDown,
  Activity,
  ArrowLeft,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { analyzeMarket } from './services/gemini';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Context ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setProfile({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
          } else {
            const newProfile: Omit<UserProfile, 'uid'> = {
              displayName: user.displayName || 'Anonymous',
              email: user.email || '',
              reputation: 0,
              role: 'user'
            };
            await setDoc(userDocRef, newProfile);
            setProfile({ uid: user.uid, ...newProfile } as UserProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

function Navbar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const { profile, logout } = useAuth();

  const tabs = [
    { id: 'forum', icon: TrendingUp, label: 'Forum' },
    { id: 'chatbot', icon: MessageSquare, label: 'AI Analyst' },
    { id: 'alerts', icon: Bell, label: 'Alerts' },
    { id: 'rankings', icon: Award, label: 'Rankings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-between items-center md:top-0 md:bottom-auto md:flex-col md:w-20 md:h-screen md:border-r md:border-t-0 md:py-8 z-50">
      <div className="hidden md:flex flex-col items-center mb-12">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200">
          CH
        </div>
      </div>

      <div className="flex w-full justify-around md:flex-col md:gap-8 md:items-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-200",
              activeTab === tab.id ? "text-indigo-600 scale-110" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
            <span className="text-[10px] font-medium uppercase tracking-wider md:hidden">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="hidden md:flex flex-col items-center gap-6 mt-auto">
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold">
            {profile?.reputation || 0}
          </div>
          <span className="text-[8px] font-bold text-gray-400 uppercase">Rep</span>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors">
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}

function Forum() {
  const { profile } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSignal, setNewSignal] = useState({ asset: '', type: 'buy', price: '' });

  useEffect(() => {
    const q = query(collection(db, 'signals'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSignals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Signal)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'signals'));
    return unsubscribe;
  }, []);

  const handleAddSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const signalData = {
        authorId: profile.uid,
        authorName: profile.displayName,
        asset: newSignal.asset.toUpperCase(),
        type: newSignal.type,
        price: parseFloat(newSignal.price),
        timestamp: new Date().toISOString()
      };
      await setDoc(doc(collection(db, 'signals')), signalData);
      setShowAdd(false);
      setNewSignal({ asset: '', type: 'buy', price: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'signals');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 pb-24 md:pb-8 md:ml-20">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Market Signals</h1>
          <p className="text-gray-500 text-sm">Community-driven trading insights</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus size={24} />
        </button>
      </header>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white border border-gray-100 rounded-3xl p-6 mb-8 shadow-xl shadow-gray-100"
          >
            <form onSubmit={handleAddSignal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Asset</label>
                  <input 
                    required
                    placeholder="BTC, ETH..."
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newSignal.asset}
                    onChange={e => setNewSignal({...newSignal, asset: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Type</label>
                  <select 
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newSignal.type}
                    onChange={e => setNewSignal({...newSignal, type: e.target.value as 'buy' | 'sell'})}
                  >
                    <option value="buy">BUY</option>
                    <option value="sell">SELL</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Target Price</label>
                <input 
                  required
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={newSignal.price}
                  onChange={e => setNewSignal({...newSignal, price: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Post Signal
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {signals.map((signal) => (
          <motion.div 
            layout
            key={signal.id}
            className="bg-white border border-gray-100 rounded-3xl p-5 flex items-center gap-4 hover:border-indigo-100 transition-all group"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
              signal.type === 'buy' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
              {signal.type === 'buy' ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-bold text-gray-900">{signal.asset}</h3>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                  signal.type === 'buy' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}>
                  {signal.type}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">
                Target: <span className="font-mono font-medium text-gray-900">${signal.price.toLocaleString()}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-bold text-gray-900">{signal.authorName}</p>
              <p className="text-[10px] text-gray-400 font-medium">
                {formatDistanceToNow(new Date(signal.timestamp))} ago
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Chatbot() {
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await analyzeMarket(input);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble analyzing the market right now." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-screen flex flex-col pt-8 px-6 pb-24 md:pb-8 md:ml-20">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">AI Analyst</h1>
        <p className="text-gray-500 text-sm">Technical analysis & market insights</p>
      </header>

      <div className="flex-1 overflow-y-auto space-y-6 mb-6 pr-2 scrollbar-hide">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-4">
              <Activity size={32} />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">How can I help you?</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Ask about technical indicators like RSI, MA, or get a market analysis for any coin.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "flex",
            msg.role === 'user' ? "justify-end" : "justify-start"
          )}>
            <div className={cn(
              "max-w-[85%] px-5 py-4 rounded-3xl text-sm leading-relaxed",
              msg.role === 'user' 
                ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-100" 
                : "bg-white border border-gray-100 text-gray-800 rounded-tl-none shadow-sm"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 px-5 py-4 rounded-3xl rounded-tl-none shadow-sm flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="relative">
        <input 
          placeholder="Ask about BTC analysis..."
          className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 pr-14 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-xl shadow-gray-100"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button 
          type="submit"
          disabled={loading}
          className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <ChevronRight size={20} />
        </button>
      </form>
    </div>
  );
}

function Alerts() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<PriceNotification[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newAlert, setNewAlert] = useState({ asset: '', targetPrice: '', condition: 'above' });

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', profile.uid),
      orderBy('asset')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAlerts(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as PriceNotification))
      );
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));
    return unsubscribe;
  }, [profile]);

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const alertData = {
        userId: profile.uid,
        asset: newAlert.asset.toUpperCase(),
        targetPrice: parseFloat(newAlert.targetPrice),
        condition: newAlert.condition,
        active: true
      };
      await setDoc(doc(collection(db, 'notifications')), alertData);
      setShowAdd(false);
      setNewAlert({ asset: '', targetPrice: '', condition: 'above' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 pb-24 md:pb-8 md:ml-20">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Price Alerts</h1>
          <p className="text-gray-500 text-sm">Never miss a price target</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          <Plus size={24} />
        </button>
      </header>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-gray-100 rounded-3xl p-6 mb-8 shadow-xl shadow-gray-100"
          >
            <form onSubmit={handleAddAlert} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Asset</label>
                  <input 
                    required
                    placeholder="BTC, ETH..."
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={newAlert.asset}
                    onChange={e => setNewAlert({...newAlert, asset: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Condition</label>
                  <select 
                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                    value={newAlert.condition}
                    onChange={e => setNewAlert({...newAlert, condition: e.target.value as 'above' | 'below'})}
                  >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Target Price</label>
                <input 
                  required
                  type="number"
                  step="any"
                  placeholder="0.00"
                  className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500"
                  value={newAlert.targetPrice}
                  onChange={e => setNewAlert({...newAlert, targetPrice: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100"
                >
                  Set Alert
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {alerts.length === 0 && (
          <div className="py-12 text-center">
            <div className="w-12 h-12 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell size={24} />
            </div>
            <p className="text-gray-400 text-sm">No active alerts</p>
          </div>
        )}
        {alerts.map((alert) => (
          <div key={alert.id} className="bg-white border border-gray-100 rounded-3xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-50 text-gray-400 rounded-xl flex items-center justify-center">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{alert.asset}</h3>
                <p className="text-xs text-gray-500">
                  {alert.condition === 'above' ? 'Price crosses above' : 'Price drops below'} <span className="font-mono font-bold text-gray-700">${alert.targetPrice}</span>
                </p>
              </div>
            </div>
            <div className={cn(
              "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
              alert.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
            )}>
              {alert.active ? 'Active' : 'Triggered'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Rankings({ onSelectUser }: { onSelectUser: (userId: string) => void }) {
  const [rankings, setRankings] = useState<UserProfile[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('reputation', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRankings(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return unsubscribe;
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 pb-24 md:pb-8 md:ml-20">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Leaderboard</h1>
        <p className="text-gray-500 text-sm">Top analysts by reputation</p>
      </header>

      <div className="bg-white border border-gray-100 rounded-[32px] overflow-hidden shadow-sm">
        {rankings.map((user, i) => (
          <button 
            key={user.uid} 
            onClick={() => onSelectUser(user.uid)}
            className={cn(
              "w-full flex items-center gap-4 p-5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-left",
              i === 0 && "bg-indigo-50/30"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
              i === 0 ? "bg-yellow-100 text-yellow-700" : 
              i === 1 ? "bg-gray-100 text-gray-600" :
              i === 2 ? "bg-orange-100 text-orange-700" : "text-gray-400"
            )}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{user.displayName}</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{user.role}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <Award size={14} className="text-indigo-600" />
                <span className="font-bold text-gray-900">{user.reputation}</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium">Points</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Profile({ userId, onBack }: { userId: string, onBack: () => void }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userSignals, setUserSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserProfile({ uid: userDoc.id, ...data } as UserProfile);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      }
    };

    const q = query(
      collection(db, 'signals'), 
      where('authorId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeSignals = onSnapshot(q, (snapshot) => {
      setUserSignals(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Signal))
      );
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'signals'));

    fetchUser();
    return unsubscribeSignals;
  }, [userId]);

  if (loading) return <div className="flex justify-center py-20"><Activity className="animate-spin text-indigo-600" /></div>;
  if (!userProfile) return <div className="text-center py-20">User not found</div>;

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 pb-24 md:pb-8 md:ml-20">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors mb-6 font-medium">
        <ArrowLeft size={20} />
        Back to Leaderboard
      </button>

      <div className="bg-white border border-gray-100 rounded-[40px] p-8 mb-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-[32px] flex items-center justify-center mb-4 shadow-inner">
            <UserIcon size={48} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{userProfile.displayName}</h1>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">{userProfile.role}</p>
          
          <div className="flex gap-8 w-full justify-center border-t border-gray-50 pt-6">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">{userProfile.reputation}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reputation</p>
            </div>
            <div className="text-center border-l border-gray-50 pl-8">
              <p className="text-2xl font-black text-gray-900">{userSignals.length}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Signals</p>
            </div>
          </div>
        </div>

        {userProfile.badges && userProfile.badges.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-50">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">Badges Earned</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {userProfile.badges.map((badge, i) => (
                <div key={i} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <Award size={14} />
                  {badge}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-6">Past Signals</h2>
      <div className="space-y-4">
        {userSignals.length === 0 && <p className="text-center text-gray-400 py-8">No signals shared yet</p>}
        {userSignals.map((signal) => (
          <div 
            key={signal.id}
            className="bg-white border border-gray-100 rounded-3xl p-5 flex items-center gap-4"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
              signal.type === 'buy' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
              {signal.type === 'buy' ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-bold text-gray-900">{signal.asset}</h3>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                  signal.type === 'buy' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}>
                  {signal.type}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">
                Target: <span className="font-mono font-medium text-gray-900">${signal.price.toLocaleString()}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-gray-400 font-medium">
                {formatDistanceToNow(new Date(signal.timestamp))} ago
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Login() {
  const { signIn } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 text-center"
      >
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-8 shadow-xl shadow-indigo-200">
          CH
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">CryptoHub</h1>
        <p className="text-gray-500 mb-10 leading-relaxed">
          Join the elite community of crypto analysts. Share signals, track alerts, and climb the rankings.
        </p>
        <button 
          onClick={signIn}
          className="w-full bg-gray-900 text-white py-5 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
        >
          <LogIn size={20} />
          Continue with Google
        </button>
        <p className="mt-8 text-[11px] text-gray-400 font-medium uppercase tracking-widest">
          Secure • Community • Real-time
        </p>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('forum');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar activeTab={activeTab === 'profile' ? 'rankings' : activeTab} setActiveTab={(tab) => {
        setActiveTab(tab);
        setSelectedUserId(null);
      }} />
      <main className="pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab === 'profile' ? `profile-${selectedUserId}` : activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'forum' && <Forum />}
            {activeTab === 'chatbot' && <Chatbot />}
            {activeTab === 'alerts' && <Alerts />}
            {activeTab === 'rankings' && <Rankings onSelectUser={(uid) => {
              setSelectedUserId(uid);
              setActiveTab('profile');
            }} />}
            {activeTab === 'profile' && selectedUserId && (
              <Profile userId={selectedUserId} onBack={() => setActiveTab('rankings')} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
