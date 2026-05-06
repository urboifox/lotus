import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface dataState {
  textSize: number;
  fontFamily: string;
  color: string;
  direction: "ltr" | "rtl";
}
const options = JSON.parse(sessionStorage.getItem("options") || "{}");
const initialState: dataState = {
  textSize: options.textSize || 30,
  direction: options.direction || "ltr",
  fontFamily: options.fontFamily || "Arial, sans-serif",
  color: options.color || "#000000",
};
export const optionsSlice = createSlice({
  name: "options",
  initialState,
  reducers: {
    setOptions: (
      state,
      action: PayloadAction<{
        textSize?: number;
        direction?: "ltr" | "rtl";
        fontFamily?: string;
        color?: string;
      }>
    ) => {
      Object.assign(state, action.payload);
      window.sessionStorage.setItem("options", JSON.stringify(state));
    },
  },
});

export const { setOptions } = optionsSlice.actions;

export default optionsSlice.reducer;
