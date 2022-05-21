export interface O2HConfig {
    wrapperOpen: string;
    wrapperClose: string;
    objPropOpen: string;
    objPropClose: string;
    stringPropOpen: string;
    stringPropValue: string;
    stringPropClose: string;
    numberPropOpen: string;
    numberPropValue: string;
    numberPropClose: string;
    rootConfig?: O2HConfig;
}