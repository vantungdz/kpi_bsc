package com.company.kpi.common.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class Utilitils {


    public static int toInt(BigDecimal value, int defaultValue) {
        if (value == null) {
            return defaultValue;
        }

        try {
            return value.setScale(0, RoundingMode.HALF_UP).intValueExact();
        } catch (ArithmeticException e) {
            return defaultValue;
        }
    }
}
