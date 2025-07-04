import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, query, addDoc, deleteDoc, where, getDocs, writeBatch, arrayUnion, Timestamp, orderBy } from 'firebase/firestore';

// --- Firebase Initialization ---
// This configuration is now loaded from the environment variable you set in Netlify.
const firebaseConfig = JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);

// This is a static ID for your application's data structure in Firestore.
const appId = 'loan-tracker-app-v1';

// Initialize Firebase services once.
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
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
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


// --- Login & Dashboard Screen ---

function LoginScreen({ userId, onSelectLoan }) {
    const [userLoans, setUserLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newLoanName, setNewLoanName] = useState('');
    const [joinLoanId, setJoinLoanId] = useState('');
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/info`);
        const unsubscribe = onSnapshot(userDocRef, async (userDoc) => {
            if (userDoc.exists()) {
                const loanIds = userDoc.data().loans || [];
                if (loanIds.length > 0) {
                    const loansQuery = query(collection(db, `artifacts/${appId}/public/data/loans`), where('__name__', 'in', loanIds));
                    const loansSnapshot = await getDocs(loansQuery);
                    const loansData = loansSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...(doc.data().settings || {})
                    }));
                    setUserLoans(loansData);
                } else {
                    setUserLoans([]);
                }
            }
            setLoading(false);
        }, (err) => {
            console.error("Error fetching user loans:", err);
            setError("Could not fetch your loans.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    const handleCreateLoan = async (e) => {
        e.preventDefault();
        if (!newLoanName.trim()) {
            setError("Please enter a name for the loan.");
            return;
        }
        setIsCreating(true);
        setError('');

        const newLoanRef = doc(collection(db, `artifacts/${appId}/public/data/loans`));
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/info`);
        const batch = writeBatch(db);

        batch.set(newLoanRef, {
            members: [userId],
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

        const trimmedLoanId = joinLoanId.trim();
        const loanDocRef = doc(db, `artifacts/${appId}/public/data/loans/${trimmedLoanId}`);
        const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile/info`);

        try {
            const loanDocQuery = query(collection(db, `artifacts/${appId}/public/data/loans`), where('__name__', '==', trimmedLoanId));
            const loanDocSnapshot = await getDocs(loanDocQuery);
            if (loanDocSnapshot.empty) {
                setError("Loan ID not found. Please check the ID and try again.");
                setIsJoining(false);
                return;
            }

            const batch = writeBatch(db);
            batch.update(loanDocRef, { members: arrayUnion(userId) });
            batch.set(userDocRef, { loans: arrayUnion(trimmedLoanId) }, { merge: true });
            await batch.commit();
            setJoinLoanId('');
        } catch (err) {
            console.error("Error joining loan:", err);
            setError("Failed to join loan. Please check the ID and try again.");
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-4xl sm:text-5xl font-bold text-gray-800">Loan Dashboard</h1>
                    <p className="text-gray-600 mt-2">Welcome! Manage your shared loans here.</p>
                    {userId && <p className="text-xs text-gray-500 mt-4 bg-gray-100 p-2 rounded-md inline-block">Your User ID: <span className="font-mono select-all">{userId}</span></p>}
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
                                placeholder="Enter Loan ID"
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
                        <Icon path="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.75A.75.75 0 0 1 3 4.5h.75m0 0h.75A.75.75 0 0 1 4.5 6v.75m0 0v.75a.75.75 0 0 1-.75.75h-.75m0 0H3.75m0 0a.75.75 0 0 1-.75-.75V6m0 0V5.25m0 0A.75.75 0 0 1 3.75 4.5h.75M15 4.5v.75A.75.75 0 0 1 14.25 6h-.75m0 0v-.75a.75.75 0 0 1 .75-.75h.75m0 0h.75a.75.75 0 0 1 .75.75v.75m0 0v.75a.75.75 0 0 1-.75.75h-.75m0 0h-.75m0 0a.75.75 0 0 1-.75-.75V6m0 0v-.75m1.5.75a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 .75.75v.75m0 0v.75a.75.75 0 0 1-.75.75h-.75a.75.75 0 0 1-.75-.75V6m3 12.75v-6.161c0-.853-.48-1.635-1.28-2.033l-7.443-4.148a.75.75 0 0 0-.976.652v11.342a.75.75 0 0 0 .976.652l7.443-4.148c.8-.398 1.28-1.18 1.28-2.033Z" className="w-6 h-6 mr-2 text-amber-500" />
                        My Loans
                    </h2>
                    {loading ? (
                        <div className="flex justify-center p-4"><Spinner /></div>
                    ) : userLoans.length > 0 ? (
                        <ul className="space-y-3">
                            {userLoans.map(loan => (
                                <li key={loan.id} onClick={() => onSelectLoan(loan.id)} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center cursor-pointer hover:bg-indigo-100 hover:shadow-md transition group">
                                    <div>
                                        <p className="font-semibold text-gray-800 group-hover:text-indigo-800">{loan.appTitle || "Untitled Loan"}</p>
                                        <p className="text-xs text-gray-500 font-mono">ID: {loan.id}</p>
                                    </div>
                                    <Icon path="m8.25 4.5 7.5 7.5-7.5 7.5" className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition" />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-4">You are not part of any loans yet. Create one or join one to get started!</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function LoanDetailScreen({ userId, loanId, onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [initialLoanAmount, setInitialLoanAmount] = useState('');
  const [initialLoanDate, setInitialLoanDate] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [appTitle, setAppTitle] = useState('Loan Tracker');
  const [newTransactionDate, setNewTransactionDate] = useState('');
  const [newTransactionType, setNewTransactionType] = useState('payment');
  const [newTransactionAmount, setNewTransactionAmount] = useState('');
  const [newTransactionDescription, setNewTransactionDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  useEffect(() => {
    setNewTransactionDate(getTodayDate());
    setInitialLoanDate(getTodayDate());
  }, []);

  useEffect(() => {
    if (!userId || !loanId) return;

    setLoading(true);
    const settingsDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanId}`);
    const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().settings) {
        const data = docSnap.data().settings;
        setInitialLoanAmount(data.initialLoanAmount || '');
        setInitialLoanDate(data.initialLoanDate ? data.initialLoanDate.toDate().toISOString().split('T')[0] : getTodayDate());
        setInterestRate(data.interestRate || '');
        setAppTitle(data.appTitle || 'Family Loan Tracker');
      }
    }, (err) => {
        console.error("Error fetching settings:", err);
        setError("Could not fetch loan settings.");
    });

    const transactionsColRef = collection(db, `artifacts/${appId}/public/data/loans/${loanId}/transactions`);
    const q = query(transactionsColRef, orderBy('date', 'asc'));
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
    if (isNaN(parseFloat(initialLoanAmount)) || isNaN(parseFloat(interestRate)) || !initialLoanDate) {
      setError("Please enter valid numbers and a date.");
      return;
    }

    setLoading(true);
    setError('');
    const settingsDocRef = doc(db, `artifacts/${appId}/public/data/loans/${loanId}`);
    try {
      await setDoc(settingsDocRef, {
        settings: {
          initialLoanAmount: parseFloat(initialLoanAmount),
          initialLoanDate: Timestamp.fromDate(new Date(initialLoanDate)),
          interestRate: parseFloat(interestRate),
          appTitle: appTitle,
          lastUpdated: Timestamp.now(),
        }
      }, { merge: true });
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

  const calculateDisplayTransactions = useCallback(() => {
    if (!initialLoanAmount || !initialLoanDate) {
      return { transactions: [], currentRunningBalance: 0 };
    }

    let runningBalance = parseFloat(initialLoanAmount);
    const calculatedTransactions = [];
    
    const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    calculatedTransactions.push({
        id: 'initial',
        date: new Date(initialLoanDate),
        description: 'Initial Loan Amount',
        amount: parseFloat(initialLoanAmount),
        type: 'initial',
        runningBalance: runningBalance,
        isInitial: true,
    });

    sortedTransactions.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.type === 'payment') {
            runningBalance -= amount;
        } else if (t.type === 'loanIncrease') {
            runningBalance += amount;
        }
        calculatedTransactions.push({ ...t, runningBalance });
    });

    return { 
        transactions: calculatedTransactions, 
        currentRunningBalance: runningBalance, 
    };
  }, [transactions, initialLoanAmount, initialLoanDate]);

  const { transactions: displayTransactions, currentRunningBalance } = useMemo(
    () => calculateDisplayTransactions(),
    [calculateDisplayTransactions]
  );
    
  const percentagePaidOff = useMemo(() => {
    if (parseFloat(initialLoanAmount) <= 0) return 0;
    const paidAmount = parseFloat(initialLoanAmount) - currentRunningBalance;
    return Math.max(0, Math.min(100, (paidAmount / parseFloat(initialLoanAmount)) * 100));
  }, [initialLoanAmount, currentRunningBalance]);

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

  const isLoanPaidOff = currentRunningBalance <= 0 && parseFloat(initialLoanAmount) > 0;

  if (loading) {
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
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">{appTitle}</h1>
                    <p className="text-xs text-gray-500 mt-2 bg-gray-200 p-2 rounded-md inline-block">Loan ID: <span className="font-mono select-all">{loanId}</span></p>
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
                {parseFloat(initialLoanAmount) > 0 && !isLoanPaidOff && (
                    <div className="w-full bg-indigo-400 rounded-full h-2.5 mt-4">
                        <div className="bg-green-400 h-2.5 rounded-full" style={{ width: `${percentagePaidOff}%` }}></div>
                    </div>
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
                <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                    <Icon path="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.125 1.125 0 010 2.25H5.625a1.125 1.125 0 010-2.25z" className="w-6 h-6 mr-3 text-indigo-500" />
                    Transaction History
                </h2>
                <div className="overflow-x-auto">
                    {displayTransactions.length <= 1 ? (
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
                                {displayTransactions.map((t) => (
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

            <AccordionSection title="Loan Settings" iconPath="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.055l.732-.41c.464-.26.996-.059 1.256.397l.547.947c.26.456.058 1.002-.398 1.256l-.732.41c-.35.197-.557.576-.557.98l0 .001c0 .403.207.782.557.98l.732.41c.456.254.658.8.398 1.256l-.547.947c-.26.456-.792.657-1.256.397l-.732-.41c-.35-.197-.807-.22-1.205-.055a1.73 1.73 0 00-.78.93l-.149.894c-.09.542-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11-.94l-.149-.894a1.73 1.73 0 00-.78-.93c-.398-.164-.855-.142-1.205.055l-.732.41c-.464.26-.996.059-1.256-.397l-.547-.947c-.26-.456-.058-1.002.398-1.256l.732-.41c.35.197.557.576.557.98l0 .001c0 .403-.207.782-.557.98l-.732-.41c-.456.254-.658.8-.398-1.256l.547-.947c.26-.456.792-.657-1.256.397l.732-.41c.35-.197.807-.22 1.205-.055.396-.166.71-.506.78-.93l.149-.894z M12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z">
                 <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                        <label htmlFor="appTitle" className="block text-sm font-medium text-gray-700 mb-1">Loan Name</label>
                        <input type="text" id="appTitle" value={appTitle} onChange={(e) => setAppTitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="initialLoanAmount" className="block text-sm font-medium text-gray-700 mb-1">Initial Amount ($)</label>
                            <input type="number" id="initialLoanAmount" value={initialLoanAmount} onChange={(e) => setInitialLoanAmount(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md"/>
                        </div>
                        <div>
                            <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 mb-1">Annual Interest Rate (%)</label>
                            <input type="number" id="interestRate" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="e.g., 5 for 5%" className="w-full p-2 border border-gray-300 rounded-md"/>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="initialLoanDate" className="block text-sm font-medium text-gray-700 mb-1">Initial Loan Date</label>
                        <input type="date" id="initialLoanDate" value={initialLoanDate} onChange={(e) => setInitialLoanDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md"/>
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

function App() {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [selectedLoanId, setSelectedLoanId] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthReady(true);
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Anonymous sign-in failed:", error);
                    setIsAuthReady(true); // Prevent infinite loading
                }
            }
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
    
    return (
        <>
            {selectedLoanId ? (
                <LoanDetailScreen userId={userId} loanId={selectedLoanId} onBack={handleBackToDashboard} />
            ) : (
                <LoginScreen userId={userId} onSelectLoan={handleSelectLoan} />
            )}
        </>
    );
}

export default App;
