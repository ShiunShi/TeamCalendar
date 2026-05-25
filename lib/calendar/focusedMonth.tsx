"use client";

import * as React from "react";
import { startOfMonth, startOfToday } from "date-fns";

interface FocusedMonthContextValue {
  focusedMonth: Date;
  setFocusedMonth: React.Dispatch<React.SetStateAction<Date>>;
}

const FocusedMonthContext = React.createContext<FocusedMonthContextValue>({
  focusedMonth: startOfMonth(startOfToday()),
  setFocusedMonth: () => {},
});

export function FocusedMonthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [focusedMonth, setFocusedMonth] = React.useState<Date>(() =>
    startOfMonth(startOfToday()),
  );
  return (
    <FocusedMonthContext.Provider value={{ focusedMonth, setFocusedMonth }}>
      {children}
    </FocusedMonthContext.Provider>
  );
}

export function useFocusedMonth() {
  return React.useContext(FocusedMonthContext);
}
