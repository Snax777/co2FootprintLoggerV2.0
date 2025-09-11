import { useState, createContext, useContext } from "react";

const AppContext = createContext();
const AuthProvider = ({children}) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userEmail, setUserEmail] = useState("");

    return (
        <AppContext.Provider value={{isLoggedIn, setIsLoggedIn, userEmail, setUserEmail}}>
            {children}
        </AppContext.Provider>
    )
};
const useAppContext = () => useContext(AppContext);

export {AuthProvider, useAppContext};