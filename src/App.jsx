import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, addDoc, deleteDoc, where, getDocs, writeBatch, arrayUnion, arrayRemove, Timestamp, orderBy } from 'firebase/firestore';

// --- Firebase Initialization ---
// IMPORTANT: Make sure your VITE_FIREBASE_CONFIG is set in your .env.local file
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
const appId = 'loan-tracker-app-v1';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


// --- Helper Components ---

const Icon = ({ path, className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const Spinner = ({ color = 'white' }) => (
    <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${color}`}></div>
);

const Modal = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const AccordionSection = ({ title, iconPath, children, defaultOpen = false, forceOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen || forceOpen);

    useEffect(() => {
        if (forceOpen) {
            setIsOpen(true);
        }
    }, [forceOpen]);

    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-200">
            <button onClick={() => !forceOpen && setIsOpen(!isOpen)} className={`w-full flex justify-between items-center text-left text-xl font-semibold text-gray-700 ${forceOpen ? 'cursor-default' : ''}`}>
                <span className="flex items-center">
                    <Icon path={iconPath} className="w-6 h-6 mr-3 text-indigo-500" />
                    {title}
                </span>
                {!forceOpen && <Icon path={isOpen ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} className="w-5 h-5 text-gray-400 transition-transform" />}
            </button>
            {isOpen && <div className="mt-4 pt-4 border-t border-gray-200">{children}</div>}
        </div>
    );
};

const Notification = ({ message, type, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const baseClasses = "fixed bottom-5 right-5 p-4 rounded-lg shadow-xl flex items-center max-w-sm z-50";
    const typeClasses = {
        success: "bg-green-500 text-white",
        error: "bg-red-500 text-white",
    };

    const iconPaths = {
        success: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
        error: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
    };

    return (
        <div className={`${baseClasses} ${typeClasses[type]}`}>
            <Icon path={iconPaths[type]} className="w-6 h-6 mr-3" />
            <span>{message}</span>
        </div>
    );
};


// --- Authentication Screen ---
function AuthScreen() {
    const [view, setView] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [notification, setNotification] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setNotification(null);
        try {
            if (view === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setNotification({ type: 'error', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setNotification(null);
        try {
            await sendPasswordResetEmail(auth, email);
            setNotification({ type: 'success', message: 'Password reset email sent! Please check your inbox.' });
        } catch (err) {
            setNotification({ type: 'error', message: err.message });
        } finally {
            setLoading(false);
        }
    };

    const renderForm = () => {
        if (view === 'forgotPassword') {
            return (
                <form onSubmit={handlePasswordReset} className="space-y-6">
                    <h2 className="text-2xl font-semibold text-center text-gray-700">Reset Password</h2>
                    <p className="text-center text-sm text-gray-600">Enter your email address and we will send you a link to reset your password.</p>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" />
                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-300 flex items-center justify-center">
                        {loading ? <Spinner /> : 'Send Reset Email'}
                    </button>
                </form>
            );
        }

        return (
            <form onSubmit={handleSubmit} className="space-y-6">
                <h2 className="text-2xl font-semibold text-center text-gray-700">{view === 'login' ? 'Log In' : 'Sign Up'}</h2>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" />
                <div className="relative">
                    <input 
                        type={isPasswordVisible ? 'text' : 'password'} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Password" 
                        required 
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" 
                    />
                    <button 
                        type="button" 
                        onClick={() => setIsPasswordVisible(!isPasswordVisible)} 
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-indigo-600"
                    >
                        <Icon path={isPasswordVisible 
                            ? "M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" 
                            : "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        } className="w-5 h-5" />
                    </button>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-300 flex items-center justify-center">
                    {loading ? <Spinner /> : (view === 'login' ? 'Log In' : 'Create Account')}
                </button>
            </form>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            {notification && <Notification message={notification.message} type={notification.type} onDismiss={() => setNotification(null)} />}
            <div className="max-w-md w-full mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800">Welcome</h1>
                    <p className="text-gray-600 mt-2">Sign in or create an account to manage your loans.</p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                    {renderForm()}
                    <div className="text-center text-sm text-gray-600 mt-6">
                        {view === 'login' && (<button onClick={() => setView('forgotPassword')} className="font-semibold text-indigo-600 hover:underline">Forgot Password?</button>)}
                        {view === 'forgotPassword' && (<button onClick={() => setView('login')} className="font-semibold text-indigo-600 hover:underline">Back to Log In</button>)}
                    </div>
                    <div className="text-center text-sm text-gray-600 mt-2">
                        {view === 'login' ? "Don't have an account?" : "Already have an account?"}
                        <button onClick={() => setView(view === 'login' ? 'signup' : 'login')} className="font-semibold text-indigo-600 hover:underline ml-1">
                            {view === 'login' ? 'Sign Up' : 'Log In'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


// --- Dashboard Screen ---

function DashboardScreen({ user, onSelectLoan }) {
    const [userLoans, setUserLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newLoanName, setNewLoanName] = useState('');
    const [joinLoanId, setJoinLoanId] = useState('');
    const [notification, setNotification] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [loanToLeave, setLoanToLeave] = useState(null);

    const generateFriendlyId = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${result.slice(0,3)}-${result.slice(3,6)}`;
    };

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const loansQuery = query(collection(db, `artifacts/${appId}/public/data/loans`), where('members', 'array-contains', user.uid));
        const unsubscribe = onSnapshot(loansQuery, (snapshot) => {
            const loansData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUserLoans(loansData);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching user loans:", err);
            setNotification({type: 'error', message: "Could not fetch your loans."});
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleCreateLoan = async (e) => {
        e.preventDefault();
        if (!newLoanName.trim()) {
            setNotification({type: 'error', message: "Please enter a name for the loan."});
            return;
        }
        setIsCreating(true);
        setNotification(null);

        const newLoanRef = doc(collection(db, `artifacts/${appId}/public/data/loans`));
        const friendlyId = generateFriendlyId();
        
        try {
            await setDoc(newLoanRef, {
                members: [user.uid],
                friendlyId: friendlyId,
                settings: {
                    appTitle: newLoanName,
                    createdAt: Timestamp.now(),
                }
            });
            setNewLoanName('');
            onSelectLoan(newLoanRef.id);
        } catch (err) {
            console.error("Error creating loan:", err);
            setNotification({type: 'error', message: "Failed to create loan. Please try again."});
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinLoan = async (e) => {
        e.preventDefault();
        if (!joinLoanId.trim()) {
            setNotification({type: 'error', message: "Please enter a Loan Code to join."});
            return;
        }
        setIsJoining(true);
        setNotification(null);

        const friendlyIdToJoin = joinLoanId.trim().toUpperCase();
        
        try {
            const loansRef = collection(db, `artifacts/${appId}/public/data/loans`);
            const q = query(loansRef, where("friendlyId", "==", friendlyIdToJoin));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setNotification({type: 'error', message: "Loan ID not found. Please check the code and try again."});
                setIsJoining(false);
                return;
            }

            const loanDoc = querySnapshot.docs[0];
            const loanDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanDoc.id}`);
            await setDoc(loanDocRef, { members: arrayUnion(user.uid) }, { merge: true });
            setJoinLoanId('');
            setNotification({type: 'success', message: `Successfully joined "${loanDoc.data().settings.appTitle}"!`});
        } catch (err) {
            console.error("Error joining loan:", err);
            setNotification({type: 'error', message: "Failed to join loan. Please check the code and try again."});
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeaveLoan = async () => {
        if (!loanToLeave || !user) return;
        
        const loanDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanToLeave.id}`);
        try {
            await setDoc(loanDocRef, { members: arrayRemove(user.uid) }, { merge: true });
            setNotification({type: 'success', message: `You have left "${loanToLeave.settings.appTitle}".`});
            setLoanToLeave(null); 
        } catch (err) {
            console.error("Error leaving loan:", err);
            setNotification({type: 'error', message: "Failed to leave the loan. Please try again."});
            setLoanToLeave(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            {notification && <Notification message={notification.message} type={notification.type} onDismiss={() => setNotification(null)} />}
            {loanToLeave && (
                <Modal onClose={() => setLoanToLeave(null)}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Loan?</h3>
                    <p className="text-sm text-gray-700 mb-6">
                        Are you sure you want to leave the loan "{loanToLeave.settings.appTitle}"? You will lose access to it unless you are invited back.
                    </p>
                    <div className="flex justify-end space-x-3">
                        <button onClick={() => setLoanToLeave(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                        <button onClick={handleLeaveLoan} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Leave Loan</button>
                    </div>
                </Modal>
            )}

            <div className="w-full max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                    <div className="text-left">
                        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800">Dashboard</h1>
                        <p className="text-gray-600 mt-1">Welcome, {user.email}</p>
                    </div>
                    <button onClick={() => signOut(auth)} className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition shadow-md">
                        Log Out
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center">
                            <Icon path="M12 4.5v15m7.5-7.5h-15" className="w-6 h-6 mr-2 text-indigo-500" />
                            Create a New Loan
                        </h2>
                        <form onSubmit={handleCreateLoan}>
                            <input type="text" value={newLoanName} onChange={(e) => setNewLoanName(e.target.value)} placeholder="e.g., Family Car Loan" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" />
                            <button type="submit" disabled={isCreating} className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-300 flex items-center justify-center">
                                {isCreating ? <Spinner /> : 'Create & Go'}
                            </button>
                        </form>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center">
                             <Icon path="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3.375 19.125a7.125 7.125 0 0 1 14.25 0" className="w-6 h-6 mr-2 text-teal-500" />
                            Join an Existing Loan
                        </h2>
                        <form onSubmit={handleJoinLoan}>
                            <input type="text" value={joinLoanId} onChange={(e) => setJoinLoanId(e.target.value)} placeholder="Enter 6-Digit Code" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition" />
                            <button type="submit" disabled={isJoining} className="w-full mt-4 bg-teal-600 text-white py-3 rounded-lg hover:bg-teal-700 transition shadow-md disabled:bg-teal-300 flex items-center justify-center">
                                {isJoining ? <Spinner /> : 'Join Loan'}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="mt-10 bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                     <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center">
                        <Icon path="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.125 1.125 0 010 2.25H5.625a1.125 1.125 0 010-2.25z" className="w-6 h-6 mr-2 text-amber-500" />
                        My Loans
                    </h2>
                    {loading ? (
                        <div className="flex justify-center p-4"><Spinner color="gray-800" /></div>
                    ) : userLoans.length > 0 ? (
                        <ul className="space-y-3">
                            {userLoans.map(loan => (
                                <li key={loan.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center transition group">
                                    <div onClick={() => onSelectLoan(loan.id)} className="flex-grow cursor-pointer">
                                        <p className="font-semibold text-gray-800 group-hover:text-indigo-800">{loan.settings.appTitle || "Untitled Loan"}</p>
                                        <p className="text-xs text-gray-500 font-mono">CODE: {loan.friendlyId}</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setLoanToLeave(loan); }} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100">
                                        <Icon path="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.134H8.09a2.09 2.09 0 00-2.09 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" className="w-5 h-5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-4">You have not joined or created any loans yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Loan Detail Screen ---
function LoanDetailScreen({ userId, loanId, onBack }) {
    const [transactions, setTransactions] = useState([]);
    const [loanData, setLoanData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);
    const [isCalculatingInterest, setIsCalculatingInterest] = useState(false);
    
    const [newTransactionDate, setNewTransactionDate] = useState('');
    const [newTransactionType, setNewTransactionType] = useState('payment');
    const [newTransactionAmount, setNewTransactionAmount] = useState('');
    const [newTransactionDescription, setNewTransactionDescription] = useState('');
    const [editingTransaction, setEditingTransaction] = useState(null);
    
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);
    
    const [sortDirection, setSortDirection] = useState('desc');

    const [formSettings, setFormSettings] = useState(null);
    const [isEditingSettings, setIsEditingSettings] = useState(false);

    const [projectionPayment, setProjectionPayment] = useState('');
    const [amortizationSchedule, setAmortizationSchedule] = useState([]);

    const getTodayDate = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    useEffect(() => {
        setNewTransactionDate(getTodayDate());
    }, []);

    useEffect(() => {
        if (loanData?.settings) {
            setFormSettings({
                appTitle: loanData.settings.appTitle || '',
                initialLoanAmount: loanData.settings.initialLoanAmount || '',
                interestRate: loanData.settings.interestRate || '',
                initialLoanDate: loanData.settings.initialLoanDate?.toDate().toISOString().split('T')[0] || ''
            });
        }
    }, [loanData]);

    const runInterestCalculation = async (currentLoanData, currentTransactions) => {
        if (isCalculatingInterest || !currentLoanData || !currentLoanData.settings?.initialLoanDate || currentLoanData.settings.interestRate == null) {
            return;
        }
        
        setIsCalculatingInterest(true);
        
        const loanRef = doc(db, `artifacts/${appId}/public/data/loans/${loanId}`);
        const transactionsRef = collection(loanRef, 'transactions');
        const batch = writeBatch(db);

        const interestQuery = query(transactionsRef, where('type', '==', 'interest'));
        const interestSnapshot = await getDocs(interestQuery);
        interestSnapshot.forEach(doc => batch.delete(doc.ref));

        const nonInterestTransactions = currentTransactions
            .filter(t => t.type !== 'interest')
            .map(t => ({...t, date: t.date.toDate()}));

        const dynamicTransactions = [
            { date: currentLoanData.settings.initialLoanDate.toDate(), amount: currentLoanData.settings.initialLoanAmount, type: 'initial' },
            ...nonInterestTransactions
        ].sort((a, b) => a.date.getTime() - b.date.getTime());

        const today = new Date();
        let dateIterator = new Date(currentLoanData.settings.initialLoanDate.toDate());
        let interestAdded = false;
        
        while(new Date(dateIterator.getFullYear(), dateIterator.getMonth() + 1, 0) < today) {
            const year = dateIterator.getFullYear();
            const month = dateIterator.getMonth();
            const startOfMonth = new Date(year, month, 1);
            const endOfMonth = new Date(year, month + 1, 0);

            let balance = dynamicTransactions
                .filter(t => t.date < startOfMonth)
                .reduce((acc, t) => {
                    const amount = parseFloat(t.amount);
                    return t.type === 'payment' ? acc - amount : acc + amount;
                }, 0);

            if (balance > 0 && currentLoanData.settings.interestRate > 0) {
                const monthlyRate = (currentLoanData.settings.interestRate / 100) / 12;
                const interestAmount = balance * monthlyRate;
                
                if(interestAmount > 0.005) {
                    const newInterestTransactionRef = doc(transactionsRef);
                    const newInterestTx = {
                        amount: interestAmount,
                        date: Timestamp.fromDate(endOfMonth),
                        description: `Monthly Interest - ${endOfMonth.toLocaleString('default', { month: 'long' })} ${year}`,
                        type: 'interest',
                        authorId: 'system',
                        createdAt: Timestamp.now()
                    };
                    batch.set(newInterestTransactionRef, newInterestTx);
                    dynamicTransactions.push({ ...newInterestTx, date: endOfMonth });
                    dynamicTransactions.sort((a,b) => a.date.getTime() - b.date.getTime());
                    interestAdded = true;
                }
            }
            dateIterator.setMonth(dateIterator.getMonth() + 1);
        }

        try {
            await batch.commit();
            if(interestAdded) {
                setNotification({type: 'success', message: 'Interest recalculated successfully.'});
            }
        } catch (err) {
            console.error("Error recalculating interest:", err);
            setNotification({type: 'error', message: 'Failed to recalculate interest.'});
        }
        
        setIsCalculatingInterest(false);
    };

    useEffect(() => {
        if (!userId || !loanId) return;

        setLoading(true);
        const settingsDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanId}`);
        const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setLoanData(docSnap.data());
            }
        }, (err) => {
            console.error("Error fetching settings:", err);
            setNotification({type: 'error', message: "Could not fetch loan settings."});
        });

        const transactionsColRef = collection(db, `artifacts/${appId}/public/data/loans/${loanId}/transactions`);
        const q = query(transactionsColRef, orderBy('date', 'asc'));
        const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
            const fetchedTransactions = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setTransactions(fetchedTransactions);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching transactions:", err);
            setNotification({type: 'error', message: "Could not fetch loan transactions."});
            setLoading(false);
        });

        return () => {
            unsubscribeSettings();
            unsubscribeTransactions();
        };
    }, [userId, loanId]);

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        if (!userId || !loanId) return;
        
        const newSettings = {
            ...loanData.settings,
            appTitle: formSettings.appTitle,
            initialLoanAmount: parseFloat(formSettings.initialLoanAmount),
            interestRate: parseFloat(formSettings.interestRate),
            initialLoanDate: Timestamp.fromDate(new Date(formSettings.initialLoanDate + 'T00:00:00')),
        };

        if (isNaN(newSettings.initialLoanAmount) || newSettings.interestRate == null || !formSettings.initialLoanDate) {
            setNotification({type: 'error', message: "Please enter valid numbers and a date for all settings."});
            return;
        }

        setLoading(true);
        setNotification(null);
        const settingsDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanId}`);
        try {
            await setDoc(settingsDocRef, { settings: newSettings }, { merge: true });
            setNotification({type: 'success', message: 'Settings saved!'});
            setIsEditingSettings(false);
            await runInterestCalculation();
        } catch (err) {
            setNotification({type: 'error', message: "Failed to save settings."});
        } finally {
            setLoading(false);
        }
    };

    const handleAddOrUpdateTransaction = async (e) => {
        e.preventDefault();
        if (!userId || !loanId) return;
        if (!newTransactionDate || isNaN(parseFloat(newTransactionAmount)) || parseFloat(newTransactionAmount) <= 0) {
            setNotification({type: 'error', message: "Please enter a valid date and amount."});
            return;
        }

        setLoading(true);
        setNotification(null);
        const transactionData = {
            date: Timestamp.fromDate(new Date(newTransactionDate + 'T00:00:00')),
            type: newTransactionType,
            amount: parseFloat(newTransactionAmount),
            description: newTransactionDescription || `${newTransactionType} on ${new Date(newTransactionDate).toLocaleDateString()}`,
            authorId: userId,
            createdAt: Timestamp.now(),
        };

        const transactionsColRef = collection(db, `artifacts/${appId}/public/data/loans/${loanId}/transactions`);
        try {
            if (editingTransaction) {
                await setDoc(doc(transactionsColRef, editingTransaction.id), transactionData, { merge: true });
                setNotification({type: 'success', message: 'Transaction updated.'});
                setEditingTransaction(null);
            } else {
                await addDoc(transactionsColRef, transactionData);
                setNotification({type: 'success', message: 'Transaction added.'});
            }
            setNewTransactionAmount('');
            setNewTransactionDescription('');
            setNewTransactionDate(getTodayDate());
            setNewTransactionType('payment'); // Reset to default
            await runInterestCalculation(); // Recalculate interest after any change
        } catch (err) {
            setNotification({type: 'error', message: "Failed to save transaction."});
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTransaction = async () => {
        if (!userId || !loanId || !transactionToDelete) return;
        setLoading(true);
        setNotification(null);
        const transactionDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanId}/transactions`, transactionToDelete);
        try {
            await deleteDoc(transactionDocRef);
            setNotification({type: 'success', message: 'Transaction deleted.'});
            await runInterestCalculation(); // Recalculate interest after delete
        } catch (err) {
            setNotification({type: 'error', message: "Failed to delete transaction."});
        } finally {
            setLoading(false);
            setShowDeleteConfirm(false);
            setTransactionToDelete(null);
        }
    };

    const { transactionsForDisplay, currentRunningBalance, lastPayment } = useMemo(() => {
        if (!loanData?.settings?.initialLoanAmount || !loanData.settings.initialLoanDate) {
            return { transactionsForDisplay: [], currentRunningBalance: 0, lastPayment: null };
        }

        let lastPaymentInfo = null;
        
        const allTransactions = [
            { id: 'initial', date: loanData.settings.initialLoanDate.toDate(), description: 'Initial Loan Amount', amount: parseFloat(loanData.settings.initialLoanAmount), type: 'initial' },
            ...transactions.map(t => ({...t, date: t.date.toDate()}))
        ].sort((a, b) => a.date.getTime() - b.date.getTime());

        let runningBalance = 0;
        const calculatedTransactions = allTransactions.map(t => {
            const amount = parseFloat(t.amount);
            if (t.type === 'payment') {
                runningBalance -= amount;
                lastPaymentInfo = { date: t.date, amount: amount };
            } else {
                runningBalance += amount;
            }
            return { ...t, runningBalance };
        });

        const sortedForDisplay = [...calculatedTransactions].sort((a, b) => {
            if (sortDirection === 'desc') {
                return b.date.getTime() - a.date.getTime();
            }
            return a.date.getTime() - b.date.getTime();
        });

        return { 
            transactionsForDisplay: sortedForDisplay, 
            currentRunningBalance: runningBalance, 
            lastPayment: lastPaymentInfo
        };
    }, [transactions, loanData, sortDirection]);
    
    const percentagePaidOff = useMemo(() => {
        if (!loanData?.settings?.initialLoanAmount || parseFloat(loanData.settings.initialLoanAmount) <= 0) return 0;
        const totalPrincipalPaid = transactions
            .filter(t => t.type === 'payment')
            .reduce((acc, t) => acc + parseFloat(t.amount), 0);
        
        return Math.max(0, Math.min(100, (totalPrincipalPaid / parseFloat(loanData.settings.initialLoanAmount)) * 100));
    }, [transactions, loanData]);

    const handleEditTransaction = (transaction) => {
        setEditingTransaction(transaction);
        setNewTransactionDate(transaction.date.toISOString().split('T')[0]);
        setNewTransactionType(transaction.type);
        setNewTransactionAmount(transaction.amount.toString());
        setNewTransactionDescription(transaction.description || '');
    };

    const handleCancelEdit = () => {
        setEditingTransaction(null);
        setNewTransactionDate(getTodayDate());
        setNewTransactionType('payment');
        setNewTransactionAmount('');
        setNewTransactionDescription('');
    };

    const handleDeleteConfirm = (transactionId) => {
        setTransactionToDelete(transactionId);
        setShowDeleteConfirm(true);
    };

    const handleCalculateProjections = () => {
        if (!projectionPayment || isNaN(parseFloat(projectionPayment)) || parseFloat(projectionPayment) <= 0) {
            setNotification({type: 'error', message: 'Please enter a valid monthly payment amount.'});
            return;
        }

        const monthlyPayment = parseFloat(projectionPayment);
        const annualRate = loanData.settings.interestRate / 100;
        const monthlyRate = annualRate / 12;
        let balance = currentRunningBalance;
        
        if (monthlyPayment <= balance * monthlyRate) {
            setNotification({type: 'error', message: 'Monthly payment must be greater than the interest to pay off the loan.'});
            setAmortizationSchedule([]);
            return;
        }

        const schedule = [];
        let month = 1;
        while (balance > 0 && month < 600) { // Safety break at 50 years
            const interestForMonth = balance * monthlyRate;
            const principalForMonth = monthlyPayment - interestForMonth;
            balance -= principalForMonth;
            schedule.push({
                month,
                payment: monthlyPayment,
                principal: principalForMonth,
                interest: interestForMonth,
                endingBalance: balance > 0 ? balance : 0
            });
            month++;
        }
        setAmortizationSchedule(schedule);
    };

    const isLoanPaidOff = currentRunningBalance <= 0 && loanData?.settings?.initialLoanAmount > 0;

    if (loading || !loanData || !formSettings) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <Spinner color="gray-800" />
            </div>
        )
    }

    const isSetupComplete = loanData?.settings?.initialLoanAmount && loanData?.settings?.initialLoanDate && loanData.settings.interestRate != null;

    return (
        <div className="min-h-screen bg-gray-100 font-inter text-gray-800 p-4 sm:p-6 lg:p-8">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style>
            {notification && <Notification message={notification.message} type={notification.type} onDismiss={() => setNotification(null)} />}
            
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <button onClick={onBack} className="mb-4 flex items-center text-indigo-600 hover:text-indigo-800 font-semibold transition">
                        <Icon path="M15.75 19.5 8.25 12l7.5-7.5" className="w-5 h-5 mr-2" />
                        Back to My Loans
                    </button>
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">{loanData.settings.appTitle}</h1>
                        <p className="text-xs text-gray-500 mt-2 bg-gray-200 p-2 rounded-md inline-block">SHARE CODE: <span className="font-mono select-all">{loanData.friendlyId}</span></p>
                    </div>
                </div>
                
                {isSetupComplete ? (
                    <>
                        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-2xl text-center">
                            <h2 className="text-lg font-semibold mb-2 opacity-80">Current Loan Balance</h2>
                            {isLoanPaidOff ? (
                                <p className="text-4xl sm:text-5xl font-bold text-green-300">Paid Off! 🎉</p>
                            ) : (
                                <p className="text-4xl sm:text-5xl font-bold">
                                    ${currentRunningBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            )}
                            {parseFloat(loanData.settings.initialLoanAmount) > 0 && !isLoanPaidOff && (
                                <div className="mt-4 space-y-2">
                                    <div className="w-full bg-indigo-400 rounded-full h-2.5">
                                        <div className="bg-green-400 h-2.5 rounded-full" style={{ width: `${percentagePaidOff}%` }}></div>
                                    </div>
                                    <p className="text-sm opacity-90">{percentagePaidOff.toFixed(1)}% Paid Off</p>
                                </div>
                            )}
                            {lastPayment && (
                                <p className="text-sm opacity-80 mt-3">
                                    Last Payment: ${lastPayment.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} on {lastPayment.date.toLocaleDateString()}
                                </p>
                            )}
                        </div>

                        <AccordionSection title={editingTransaction ? "Edit Transaction" : "Add Transaction"} iconPath="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" defaultOpen={!editingTransaction} forceOpen={!!editingTransaction}>
                            <form onSubmit={handleAddOrUpdateTransaction} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="transactionDate" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                        <input type="date" id="transactionDate" value={newTransactionDate} onChange={(e) => setNewTransactionDate(e.target.value)} required className="w-full p-2 border border-gray-300 rounded-md"/>
                                    </div>
                                    <div>
                                        <label htmlFor="transactionType" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                        <select id="transactionType" value={newTransactionType} onChange={(e) => setNewTransactionType(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
                                            <option value="payment">Payment</option>
                                            <option value="loanIncrease">Loan Increase</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="transactionAmount" className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                    <input type="number" id="transactionAmount" value={newTransactionAmount} onChange={(e) => setNewTransactionAmount(e.target.value)} placeholder="0.00" required step="0.01" className="w-full p-2 border border-gray-300 rounded-md"/>
                                </div>
                                <div>
                                    <label htmlFor="transactionDescription" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                    <input type="text" id="transactionDescription" value={newTransactionDescription} onChange={(e) => setNewTransactionDescription(e.target.value)} placeholder="e.g., Monthly payment" className="w-full p-2 border border-gray-300 rounded-md"/>
                                </div>
                                <div className="flex gap-4">
                                    <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 shadow-md disabled:bg-indigo-300">
                                        {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
                                    </button>
                                    {editingTransaction && <button type="button" onClick={handleCancelEdit} className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">Cancel</button>}
                                </div>
                            </form>
                        </AccordionSection>

                        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold text-gray-700 flex items-center">
                                    <Icon path="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.125 1.125 0 010 2.25H5.625a1.125 1.125 0 010-2.25z" className="w-6 h-6 mr-3 text-indigo-500" />
                                    Transaction History
                                </h2>
                                <button onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
                                    Sort by Date {sortDirection === 'desc' ? <Icon path="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" className="w-4 h-4 ml-1" /> : <Icon path="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" className="w-4 h-4 ml-1" />}
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                {transactionsForDisplay.length <= 1 && transactions.filter(t => t.type !== 'initial').length === 0 ? (
                                    <p className="text-center text-gray-500 py-4">No transactions recorded yet.</p>
                                ) : (
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {transactionsForDisplay.map((t) => (
                                            <tr key={t.id} className={t.type === 'initial' ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.date.toLocaleDateString()}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.description}</td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${t.type === 'payment' ? 'text-green-600' : t.type === 'interest' ? 'text-orange-600' : 'text-red-600'}`}>
                                                    {t.type !== 'initial' && (t.type === 'payment' ? '-' : '+')}
                                                    ${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">${t.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    {t.type !== 'initial' && t.authorId !== 'system' && (
                                                        <>
                                                        <button onClick={() => handleEditTransaction(t)} className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                                                        <button onClick={() => handleDeleteConfirm(t.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {loanData.settings.interestRate > 0 && (
                        <AccordionSection title="Loan Projections" iconPath="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18v-6m-18 6h18">
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="projectionPayment" className="block text-sm font-medium text-gray-700 mb-1">Enter a Monthly Payment Amount ($)</label>
                                    <div className="flex gap-2">
                                        <input type="number" id="projectionPayment" value={projectionPayment} onChange={(e) => setProjectionPayment(e.target.value)} placeholder="e.g., 500" className="w-full p-2 border border-gray-300 rounded-md"/>
                                        <button onClick={handleCalculateProjections} className="bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 shadow-md">Calculate</button>
                                    </div>
                                </div>
                                {amortizationSchedule.length > 0 && (
                                    <div className="overflow-x-auto max-h-96">
                                         <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Principal</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ending Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {amortizationSchedule.map(row => (
                                                    <tr key={row.month}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.month}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">${row.payment.toFixed(2)}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">${row.principal.toFixed(2)}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 text-right">${row.interest.toFixed(2)}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">${row.endingBalance.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </AccordionSection>
                        )}
                    </>
                ) : null}

                <AccordionSection title="Loan Settings" iconPath="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.055l.732-.41c.464-.26.996-.059 1.256.397l.547.947c.26.456.058 1.002-.398 1.256l-.732.41c-.35.197-.557.576-.557.98l0 .001c0 .403.207.782.557.98l.732.41c.456.254.658.8-.398-1.256l-.547-.947c-.26.456-.792.657-1.256.397l-.732-.41c-.35-.197-.807-.22-1.205-.055a1.73 1.73 0 00-.78.93l-.149.894c-.09.542-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11-.94l-.149-.894a1.73 1.73 0 00-.78-.93c-.398-.164-.855-.142-1.205.055l-.732.41c-.464.26-.996-.059-1.256-.397l-.547-.947c-.26-.456-.058-1.002.398-1.256l.732-.41c.35.197.557.576.557.98l0 .001c0 .403-.207.782.557.98l-.732-.41c-.456.254-.658.8-.398-1.256l.547-.947c.26.456.792.657-1.256.397l.732-.41c.35-.197.807-.22 1.205-.055.396-.166.71-.506.78-.93l.149-.894z M12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" forceOpen={!isSetupComplete}>
                   { !isSetupComplete && <p className="text-center text-red-600 bg-red-100 p-3 rounded-lg mb-4">Welcome! Let's get your loan set up. Please fill out the details below to get started.</p> }
                   <form onSubmit={handleSaveSettings} className="space-y-4">
                      <div>
                          <label htmlFor="appTitle" className="block text-sm font-medium text-gray-700 mb-1">Loan Name</label>
                          <input type="text" id="appTitle" value={formSettings.appTitle} onChange={(e) => setFormSettings({...formSettings, appTitle: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md" disabled={!isEditingSettings && isSetupComplete}/>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                              <label htmlFor="initialLoanAmount" className="block text-sm font-medium text-gray-700 mb-1">Initial Amount ($)</label>
                              <input type="number" id="initialLoanAmount" value={formSettings.initialLoanAmount} onChange={(e) => setFormSettings({...formSettings, initialLoanAmount: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md" disabled={!isEditingSettings && isSetupComplete}/>
                          </div>
                          <div>
                              <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 mb-1">Annual Interest Rate (%)</label>
                              <input type="number" id="interestRate" step="0.01" value={formSettings.interestRate} onChange={(e) => setFormSettings({...formSettings, interestRate: e.target.value})} placeholder="e.g., 5.25" className="w-full p-2 border border-gray-300 rounded-md" disabled={!isEditingSettings && isSetupComplete}/>
                          </div>
                      </div>
                       <div>
                          <label htmlFor="initialLoanDate" className="block text-sm font-medium text-gray-700 mb-1">Initial Loan Date</label>
                          <input type="date" id="initialLoanDate" value={formSettings.initialLoanDate} onChange={(e) => setFormSettings({...formSettings, initialLoanDate: e.target.value})} className="w-full p-2 border border-gray-300 rounded-md" disabled={!isEditingSettings && isSetupComplete}/>
                      </div>
                      {isEditingSettings || !isSetupComplete ? (
                          <div className="flex gap-4">
                              <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 shadow-md disabled:bg-indigo-300">
                                  Save Settings
                              </button>
                              {isSetupComplete && <button type="button" onClick={() => setIsEditingSettings(false)} className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">
                                  Cancel
                              </button>}
                          </div>
                      ) : (
                          <button type="button" onClick={() => setIsEditingSettings(true)} className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300">
                              Edit Settings
                          </button>
                      )}
                  </form>
                </AccordionSection>

                {showDeleteConfirm && (
                    <Modal onClose={() => setShowDeleteConfirm(false)}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Deletion</h3>
                        <p className="text-sm text-gray-700 mb-6">Are you sure? This cannot be undone.</p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                            <button onClick={handleDeleteTransaction} disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">{loading ? 'Deleting...' : 'Delete'}</button>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
}


// --- Main App Component (Router) ---

function App() {
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [selectedLoanId, setSelectedLoanId] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    const handleSelectLoan = (loanId) => {
        setSelectedLoanId(loanId);
    };

    const handleBackToDashboard = () => {
        setSelectedLoanId(null);
    };

    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-center">
                    <Spinner color="gray-800" />
                    <p className="mt-4 text-lg font-semibold text-gray-700">Connecting...</p>
                </div>
            </div>
        );
    }
    
    if (!user) {
        return <AuthScreen />;
    }

    return (
        <>
            {selectedLoanId ? (
                <LoanDetailScreen userId={user.uid} loanId={selectedLoanId} onBack={handleBackToDashboard} />
            ) : (
                <DashboardScreen user={user} onSelectLoan={handleSelectLoan} />
            )}
        </>
    );
}

export default App;
