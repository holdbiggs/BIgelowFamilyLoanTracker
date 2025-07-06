import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, addDoc, deleteDoc, where, getDocs, writeBatch, arrayUnion, arrayRemove, Timestamp, orderBy } from 'firebase/firestore';

// --- Firebase Initialization ---
// Vite uses `import.meta.env.VITE_` to access environment variables
const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
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

const Spinner = () => (
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
);

const Modal = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const AccordionSection = ({ title, iconPath, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg border border-gray-200">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center text-left text-xl font-semibold text-gray-700">
                <span className="flex items-center">
                    <Icon path={iconPath} className="w-6 h-6 mr-3 text-indigo-500" />
                    {title}
                </span>
                <Icon path={isOpen ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} className="w-5 h-5 text-gray-400 transition-transform" />
            </button>
            {isOpen && <div className="mt-4 pt-4 border-t border-gray-200">{children}</div>}
        </div>
    );
};

// --- Authentication Screen ---
function AuthScreen() {
    const [view, setView] = useState('login'); // 'login', 'signup', 'forgotPassword'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        try {
            if (view === 'login') {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('Password reset email sent! Please check your inbox.');
        } catch (err) {
            setError(err.message);
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
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address"
                        required
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
                    />
                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-300 flex items-center justify-center">
                        {loading ? <Spinner /> : 'Send Reset Email'}
                    </button>
                </form>
            );
        }

        return (
            <form onSubmit={handleAuthSubmit} className="space-y-6">
                <h2 className="text-2xl font-semibold text-center text-gray-700">{view === 'login' ? 'Log In' : 'Sign Up'}</h2>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
                />
                <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition shadow-md disabled:bg-indigo-300 flex items-center justify-center">
                    {loading ? <Spinner /> : (view === 'login' ? 'Log In' : 'Create Account')}
                </button>
            </form>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800">Welcome</h1>
                    <p className="text-gray-600 mt-2">Sign in or create an account to manage your loans.</p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                    {renderForm()}
                    {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
                    {message && <p className="text-green-500 text-sm text-center mt-4">{message}</p>}
                    
                    <div className="text-center text-sm text-gray-600 mt-6">
                        {view === 'login' && (
                            <button onClick={() => setView('forgotPassword')} className="font-semibold text-indigo-600 hover:underline">
                                Forgot Password?
                            </button>
                        )}
                        {view === 'forgotPassword' && (
                            <button onClick={() => setView('login')} className="font-semibold text-indigo-600 hover:underline">
                                Back to Log In
                            </button>
                        )}
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
    const [error, setError] = useState('');
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
            setError("Could not fetch your loans.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleCreateLoan = async (e) => {
        e.preventDefault();
        if (!newLoanName.trim()) {
            setError("Please enter a name for the loan.");
            return;
        }
        setIsCreating(true);
        setError('');

        const newLoanRef = doc(collection(db, `artifacts/${appId}/public/data/loans`));
        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/info`);
        const friendlyId = generateFriendlyId();
        
        const batch = writeBatch(db);

        batch.set(newLoanRef, {
            members: [user.uid],
            friendlyId: friendlyId,
            settings: {
                appTitle: newLoanName,
                createdAt: Timestamp.now(),
            }
        });
        
        batch.set(userDocRef, { loans: arrayUnion(newLoanRef.id) }, { merge: true });

        try {
            await batch.commit();
            setNewLoanName('');
            onSelectLoan(newLoanRef.id);
        } catch (err) {
            console.error("Error creating loan:", err);
            setError("Failed to create loan. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinLoan = async (e) => {
        e.preventDefault();
        if (!joinLoanId.trim()) {
            setError("Please enter a Loan ID to join.");
            return;
        }
        setIsJoining(true);
        setError('');

        const friendlyIdToJoin = joinLoanId.trim().toUpperCase();
        
        try {
            const loansRef = collection(db, `artifacts/${appId}/public/data/loans`);
            const q = query(loansRef, where("friendlyId", "==", friendlyIdToJoin));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError("Loan ID not found. Please check the code and try again.");
                setIsJoining(false);
                return;
            }

            const loanDoc = querySnapshot.docs[0];
            const loanDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanDoc.id}`);
            const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/info`);
            
            const batch = writeBatch(db);
            batch.update(loanDocRef, { members: arrayUnion(user.uid) });
            batch.set(userDocRef, { loans: arrayUnion(loanDoc.id) }, { merge: true });
            
            await batch.commit();
            setJoinLoanId('');

        } catch (err) {
            console.error("Error joining loan:", err);
            setError("Failed to join loan. Please check the code and try again.");
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeaveLoan = async () => {
        if (!loanToLeave || !user) return;
        
        const loanDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanToLeave.id}`);
        const userDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/profile/info`);

        const batch = writeBatch(db);
        batch.update(loanDocRef, { members: arrayRemove(user.uid) });
        batch.update(userDocRef, { loans: arrayRemove(loanToLeave.id) });

        try {
            await batch.commit();
            setLoanToLeave(null); // Close the modal
        } catch (err) {
            console.error("Error leaving loan:", err);
            setError("Failed to leave the loan. Please try again.");
            setLoanToLeave(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4">
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
                
                {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg mb-4 text-center">{error}</p>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex items-center">
                            <Icon path="M12 4.5v15m7.5-7.5h-15" className="w-6 h-6 mr-2 text-indigo-500" />
                            Create a New Loan
                        </h2>
                        <form onSubmit={handleCreateLoan}>
                            <input
                                type="text"
                                value={newLoanName}
                                onChange={(e) => setNewLoanName(e.target.value)}
                                placeholder="e.g., Family Car Loan"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
                            />
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
                            <input
                                type="text"
                                value={joinLoanId}
                                onChange={(e) => setJoinLoanId(e.target.value)}
                                placeholder="Enter 6-Digit Code"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                            />
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
                        <div className="flex justify-center p-4"><Spinner /></div>
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
  const [error, setError] = useState('');
  
  const [newTransactionDate, setNewTransactionDate] = useState('');
  const [newTransactionType, setNewTransactionType] = useState('payment');
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionDescription, setNewTransactionDescription] = useState('');
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  
  // New state for sorting transaction history
  const [sortDirection, setSortDirection] = useState('desc');

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  useEffect(() => {
    setNewTransactionDate(getTodayDate());
  }, []);

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
        setError("Could not fetch loan settings.");
    });

    const transactionsColRef = collection(db, `artifacts/${appId}/public/data/loans/${loanId}/transactions`);
    const q = query(transactionsColRef, orderBy('date', 'asc')); // Always fetch ascending
    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const fetchedTransactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
      }));
      setTransactions(fetchedTransactions);
      setLoading(false);
    }, (err) => {
        console.error("Error fetching transactions:", err);
        setError("Could not fetch loan transactions.");
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
        appTitle: e.target.appTitle.value,
        initialLoanAmount: parseFloat(e.target.initialLoanAmount.value),
        interestRate: parseFloat(e.target.interestRate.value),
        initialLoanDate: Timestamp.fromDate(new Date(e.target.initialLoanDate.value)),
    }

    if (isNaN(newSettings.initialLoanAmount) || isNaN(newSettings.interestRate) || !newSettings.initialLoanDate) {
      setError("Please enter valid numbers and a date for all settings.");
      return;
    }

    setLoading(true);
    setError('');
    const settingsDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanId}`);
    try {
      await setDoc(settingsDocRef, { settings: newSettings }, { merge: true });
    } catch (err) {
      setError("Failed to save settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrUpdateTransaction = async (e) => {
    e.preventDefault();
    if (!userId || !loanId) return;
    if (!newTransactionDate || isNaN(parseFloat(newTransactionAmount)) || parseFloat(newTransactionAmount) <= 0) {
        setError("Please enter a valid date and amount.");
        return;
    }

    setLoading(true);
    setError('');
    const transactionData = {
        date: Timestamp.fromDate(new Date(newTransactionDate)),
        type: newTransactionType,
        amount: parseFloat(newTransactionAmount),
        description: newTransactionDescription || `${newTransactionType} on ${new Date(newTransactionDate).toLocaleDateString()}`,
        authorId: userId,
        createdAt: Timestamp.now(),
    };

    const transactionsColRef = collection(db, `artifacts/${appId}/public/data/loans/${loanId}/transactions`);
    try {
        if (editingTransactionId) {
            await setDoc(doc(transactionsColRef, editingTransactionId), transactionData, { merge: true });
            setEditingTransactionId(null);
        } else {
            await addDoc(transactionsColRef, transactionData);
        }
        setNewTransactionAmount('');
        setNewTransactionDescription('');
        setNewTransactionDate(getTodayDate());
    } catch (err) {
        setError("Failed to save transaction.");
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (!userId || !loanId || !transactionToDelete) return;
    setLoading(true);
    setError('');
    const transactionDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanId}/transactions`, transactionToDelete);
    try {
        await deleteDoc(transactionDocRef);
    } catch (err) {
        setError("Failed to delete transaction.");
    } finally {
        setLoading(false);
        setShowDeleteConfirm(false);
        setTransactionToDelete(null);
    }
  };

  const { transactionsForDisplay, currentRunningBalance, lastPayment } = useMemo(() => {
    if (!loanData?.settings?.initialLoanAmount || !loanData?.settings?.initialLoanDate) {
      return { transactionsForDisplay: [], currentRunningBalance: loanData?.settings?.initialLoanAmount || 0, lastPayment: null };
    }

    let runningBalance = parseFloat(loanData.settings.initialLoanAmount);
    let lastPaymentInfo = null;
    const calculatedTransactions = [];
    
    const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    calculatedTransactions.push({
        id: 'initial',
        date: loanData.settings.initialLoanDate.toDate(),
        description: 'Initial Loan Amount',
        amount: parseFloat(loanData.settings.initialLoanAmount),
        type: 'initial',
        runningBalance: runningBalance,
        isInitial: true,
    });

    sortedTransactions.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.type === 'payment') {
            runningBalance -= amount;
            lastPaymentInfo = { date: t.date, amount };
        } else if (t.type === 'loanIncrease') {
            runningBalance += amount;
        }
        calculatedTransactions.push({ ...t, runningBalance });
    });

    // Now sort for display based on the user's choice
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
    const paidAmount = parseFloat(loanData.settings.initialLoanAmount) - currentRunningBalance;
    return Math.max(0, Math.min(100, (paidAmount / parseFloat(loanData.settings.initialLoanAmount)) * 100));
  }, [loanData, currentRunningBalance]);

  const handleEditTransaction = (transaction) => {
    setEditingTransactionId(transaction.id);
    setNewTransactionDate(transaction.date.toISOString().split('T')[0]);
    setNewTransactionType(transaction.type);
    setNewTransactionAmount(transaction.amount.toString());
    setNewTransactionDescription(transaction.description || '');
  };

  const handleCancelEdit = () => {
    setEditingTransactionId(null);
    setNewTransactionDate(getTodayDate());
    setNewTransactionType('payment');
    setNewTransactionAmount('');
    setNewTransactionDescription('');
  };

  const handleDeleteConfirm = (transactionId) => {
    setTransactionToDelete(transactionId);
    setShowDeleteConfirm(true);
  };

  const isLoanPaidOff = currentRunningBalance <= 0 && loanData?.settings?.initialLoanAmount > 0;

  if (loading || !loanData) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-gray-100">
              <Spinner />
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-gray-100 font-inter text-gray-800 p-4 sm:p-6 lg:p-8">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'); body { font-family: 'Inter', sans-serif; }`}</style>
        
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

            {error && <p className="text-red-500 bg-red-100 p-3 rounded-lg text-center">{error}</p>}
            
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

            <AccordionSection title="Add Transaction" iconPath="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" defaultOpen={true}>
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
                            {editingTransactionId ? 'Update Transaction' : 'Add Transaction'}
                        </button>
                        {editingTransactionId && <button type="button" onClick={handleCancelEdit} className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600">Cancel</button>}
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
                    {transactionsForDisplay.length <= 1 ? (
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
                                <tr key={t.id} className={t.isInitial ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.date.toLocaleDateString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.description}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${t.type === 'payment' ? 'text-green-600' : t.type === 'initial' ? 'text-gray-800' : 'text-red-600'}`}>
                                        {t.type !== 'initial' && (t.type === 'payment' ? '-' : '+')}
                                        ${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">${t.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {!t.isInitial && (
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

            <AccordionSection title="Loan Settings" iconPath="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.055l.732-.41c.464-.26.996-.059 1.256.397l.547.947c.26.456.058 1.002-.398 1.256l-.732.41c-.35.197-.557.576-.557.98l0 .001c0 .403.207.782.557.98l.732.41c.456.254.658.8-.398-1.256l-.547-.947c-.26.456-.792.657-1.256.397l-.732-.41c-.35-.197-.807-.22-1.205-.055a1.73 1.73 0 00-.78.93l-.149.894c-.09.542-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11-.94l-.149-.894a1.73 1.73 0 00-.78-.93c-.398-.164-.855-.142-1.205.055l-.732.41c-.464.26-.996.059-1.256-.397l-.547-.947c-.26-.456-.058-1.002.398-1.256l.732-.41c.35.197.557.576.557.98l0 .001c0 .403-.207.782.557.98l-.732-.41c-.456.254-.658.8-.398-1.256l.547-.947c.26.456.792.657-1.256.397l.732-.41c.35-.197.807-.22 1.205-.055.396-.166.71-.506.78-.93l.149-.894z M12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z">
                 <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                        <label htmlFor="appTitle" className="block text-sm font-medium text-gray-700 mb-1">Loan Name</label>
                        <input type="text" id="appTitle" defaultValue={loanData.settings.appTitle} className="w-full p-2 border border-gray-300 rounded-md"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="initialLoanAmount" className="block text-sm font-medium text-gray-700 mb-1">Initial Amount ($)</label>
                            <input type="number" id="initialLoanAmount" defaultValue={loanData.settings.initialLoanAmount} className="w-full p-2 border border-gray-300 rounded-md"/>
                        </div>
                        <div>
                            <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 mb-1">Annual Interest Rate (%)</label>
                            <input type="number" id="interestRate" defaultValue={loanData.settings.interestRate} placeholder="e.g., 5 for 5%" className="w-full p-2 border border-gray-300 rounded-md"/>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="initialLoanDate" className="block text-sm font-medium text-gray-700 mb-1">Initial Loan Date</label>
                        <input type="date" id="initialLoanDate" defaultValue={loanData.settings.initialLoanDate?.toDate().toISOString().split('T')[0] || ''} className="w-full p-2 border border-gray-300 rounded-md"/>
                    </div>
                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 shadow-md disabled:bg-indigo-300">
                        Save Settings
                    </button>
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
                    <Spinner />
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
