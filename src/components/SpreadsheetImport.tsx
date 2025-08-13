import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRaceStore } from '@/store/raceStore';
import { Runner } from '@/types/race';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, Users, AlertCircle, Check, X, RefreshCw } from 'lucide-react';

interface SpreadsheetImportProps {
  isOpen: boolean;
  onClose: () => void;
}

type ParsedRow = {
  [key: string]: string | number;
};

type ColumnMapping = {
  name?: string;
  pace?: string;
  van?: string;
};

type ValidationError = {
  row: number;
  field: string;
  value: string;
  error: string;
};

const SpreadsheetImport: React.FC<SpreadsheetImportProps> = ({ isOpen, onClose }) => {
  const { setRunners } = useRaceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State management
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [previewRunners, setPreviewRunners] = useState<Runner[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset all state when modal opens/closes
  const resetState = () => {
    setCurrentStep('upload');
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setColumnMapping({});
    setPreviewRunners([]);
    setValidationErrors([]);
    setImportProgress(0);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // File processing
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Reset any previous errors
    setValidationErrors([]);

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv'
    ];

    // Check file size (limit to 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setValidationErrors([{
        row: 0,
        field: 'file',
        value: '',
        error: 'File size too large. Please use files smaller than 10MB.'
      }]);
      return;
    }

    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setValidationErrors([{
        row: 0,
        field: 'file',
        value: selectedFile.name,
        error: 'Please select a valid Excel (.xlsx, .xls) or CSV file'
      }]);
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    setIsProcessing(true);
    setValidationErrors([]);
    
    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        // Parse CSV
        Papa.parse(file, {
          complete: (results) => {
            try {
              if (results.errors.length > 0) {
                console.error('CSV parsing errors:', results.errors);
                setValidationErrors([{
                  row: 0,
                  field: 'file',
                  value: file.name,
                  error: `CSV parsing errors: ${results.errors[0]?.message || 'Unknown error'}`
                }]);
                setIsProcessing(false);
                return;
              }
              
              const data = results.data as string[][];
              if (!data || data.length === 0) {
                setValidationErrors([{
                  row: 0,
                  field: 'file',
                  value: file.name,
                  error: 'File appears to be empty or has no valid data'
                }]);
                setIsProcessing(false);
                return;
              }
              
              const headerRow = data[0]?.filter(header => header?.toString().trim()) || [];
              if (headerRow.length === 0) {
                setValidationErrors([{
                  row: 0,
                  field: 'file',
                  value: file.name,
                  error: 'No valid headers found in first row'
                }]);
                setIsProcessing(false);
                return;
              }
              
              const dataRows = data.slice(1).filter(row => row && row.some(cell => cell?.toString().trim()));
              if (dataRows.length === 0) {
                setValidationErrors([{
                  row: 0,
                  field: 'file',
                  value: file.name,
                  error: 'No data rows found after header'
                }]);
                setIsProcessing(false);
                return;
              }
              
              setHeaders(headerRow.map(h => h.toString()));
              setParsedData(dataRows.map((row) => {
                const obj: ParsedRow = {};
                headerRow.forEach((header, i) => {
                  obj[header.toString()] = row[i]?.toString() || '';
                });
                return obj;
              }));
              setCurrentStep('mapping');
              setIsProcessing(false);
            } catch (innerError) {
              console.error('CSV processing error:', innerError);
              setValidationErrors([{
                row: 0,
                field: 'file',
                value: file.name,
                error: 'Error processing CSV data. Please check file format.'
              }]);
              setIsProcessing(false);
            }
          },
          header: false,
          skipEmptyLines: true,
          error: (error) => {
            console.error('CSV parsing error:', error);
            setValidationErrors([{
              row: 0,
              field: 'file',
              value: file.name,
              error: `CSV parsing error: ${error.message || 'Unknown error'}`
            }]);
            setIsProcessing(false);
          }
        });
      } else {
        // Parse Excel
        try {
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            setValidationErrors([{
              row: 0,
              field: 'file',
              value: file.name,
              error: 'No worksheets found in Excel file'
            }]);
            setIsProcessing(false);
            return;
          }
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          if (!worksheet) {
            setValidationErrors([{
              row: 0,
              field: 'file',
              value: file.name,
              error: 'Could not read worksheet data'
            }]);
            setIsProcessing(false);
            return;
          }
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
          
          if (!jsonData || jsonData.length === 0) {
            setValidationErrors([{
              row: 0,
              field: 'file',
              value: file.name,
              error: 'Excel file appears to be empty'
            }]);
            setIsProcessing(false);
            return;
          }
          
          const headerRow = jsonData[0]?.filter(header => header?.toString().trim()) || [];
          if (headerRow.length === 0) {
            setValidationErrors([{
              row: 0,
              field: 'file',
              value: file.name,
              error: 'No valid headers found in first row of Excel file'
            }]);
            setIsProcessing(false);
            return;
          }
          
          const dataRows = jsonData.slice(1).filter(row => row && row.some(cell => cell?.toString()?.trim()));
          if (dataRows.length === 0) {
            setValidationErrors([{
              row: 0,
              field: 'file',
              value: file.name,
              error: 'No data rows found after header in Excel file'
            }]);
            setIsProcessing(false);
            return;
          }
          
          setHeaders(headerRow.map(h => h.toString()));
          setParsedData(dataRows.map((row) => {
            const obj: ParsedRow = {};
            headerRow.forEach((header, i) => {
              obj[header.toString()] = row[i]?.toString() || '';
            });
            return obj;
          }));
          setCurrentStep('mapping');
        } catch (excelError) {
          console.error('Excel parsing error:', excelError);
          setValidationErrors([{
            row: 0,
            field: 'file',
            value: file.name,
            error: 'Error reading Excel file. Please ensure it\'s a valid Excel format.'
          }]);
        }
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('File parsing error:', error);
      setValidationErrors([{
        row: 0,
        field: 'file',
        value: file.name,
        error: 'Unexpected error parsing file. Please try a different file.'
      }]);
      setIsProcessing(false);
    }
  };

  // Column mapping helpers
  const suggestColumnMapping = (headers: string[]) => {
    const mapping: ColumnMapping = {};
    
    headers.forEach(header => {
      const lower = header.toLowerCase();
      
      // Name field suggestions
      if (lower.includes('name') || lower.includes('runner') || lower === 'athlete') {
        mapping.name = header;
      }
      
      // Pace field suggestions
      if (lower.includes('pace') || lower.includes('time') || lower.includes('speed')) {
        mapping.pace = header;
      }
      
      // Van field suggestions  
      if (lower.includes('van') || lower.includes('team') || lower.includes('group')) {
        mapping.van = header;
      }
    });
    
    return mapping;
  };

  const handleMappingComplete = () => {
    if (!columnMapping.name) {
      alert('Please select a column for runner names');
      return;
    }
    
    generatePreview();
  };

  // Data validation and preview
  const parsePace = (paceValue: string | number): { seconds: number; error?: string } => {
    if (typeof paceValue === 'number') {
      // Assume it's already in seconds or minutes
      if (paceValue > 60) {
        return { seconds: paceValue };
      } else {
        return { seconds: paceValue * 60 };
      }
    }
    
    const paceStr = paceValue.toString().trim();
    if (!paceStr) {
      return { seconds: 420 }; // Default 7:00 pace
    }
    
    // Handle MM:SS format
    if (paceStr.includes(':')) {
      const parts = paceStr.split(':');
      if (parts.length === 2) {
        const minutes = parseInt(parts[0]);
        const seconds = parseInt(parts[1]);
        if (!isNaN(minutes) && !isNaN(seconds)) {
          return { seconds: minutes * 60 + seconds };
        }
      }
      return { seconds: 420, error: `Invalid pace format: ${paceStr}` };
    }
    
    // Handle decimal minutes
    const decimal = parseFloat(paceStr);
    if (!isNaN(decimal)) {
      return { seconds: Math.round(decimal * 60) };
    }
    
    return { seconds: 420, error: `Could not parse pace: ${paceStr}` };
  };

  const parseVan = (vanValue: string | number): { van: 1 | 2; error?: string } => {
    const vanStr = vanValue.toString().trim().toLowerCase();
    
    if (vanStr === '1' || vanStr === 'van 1' || vanStr === 'van1' || vanStr === 'team 1') {
      return { van: 1 };
    }
    if (vanStr === '2' || vanStr === 'van 2' || vanStr === 'van2' || vanStr === 'team 2') {
      return { van: 2 };
    }
    
    return { van: 1, error: `Unknown van assignment: ${vanValue}, defaulting to Van 1` };
  };

  const generatePreview = () => {
    const runners: Runner[] = [];
    const errors: ValidationError[] = [];
    let runnerIndex = 1;

    parsedData.forEach((row, rowIndex) => {
      const name = row[columnMapping.name!]?.toString().trim();
      if (!name) {
        errors.push({
          row: rowIndex + 1,
          field: 'name',
          value: '',
          error: 'Runner name is required'
        });
        return;
      }

      // Parse pace
      const paceValue = columnMapping.pace ? row[columnMapping.pace] : '';
      const paceResult = parsePace(paceValue);
      if (paceResult.error) {
        errors.push({
          row: rowIndex + 1,
          field: 'pace',
          value: paceValue?.toString() || '',
          error: paceResult.error
        });
      }

      // Parse van assignment
      const vanValue = columnMapping.van ? row[columnMapping.van] : '';
      const vanResult = parseVan(vanValue || (runnerIndex <= 6 ? '1' : '2'));
      if (vanResult.error) {
        errors.push({
          row: rowIndex + 1,
          field: 'van',
          value: vanValue?.toString() || '',
          error: vanResult.error
        });
      }

      runners.push({
        id: runnerIndex++,
        name,
        pace: paceResult.seconds,
        van: vanResult.van
      });
    });

    // Ensure we have exactly 12 runners (fill or trim as needed)
    while (runners.length < 12) {
      runners.push({
        id: runners.length + 1,
        name: `Runner ${runners.length + 1}`,
        pace: 420,
        van: runners.length < 6 ? 1 : 2
      });
    }

    if (runners.length > 12) {
      runners.splice(12);
      errors.push({
        row: -1, // Use -1 to indicate this is a general warning, not a row-specific error
        field: 'general',
        value: '',
        error: `Too many runners found (${parsedData.length}). Only the first 12 will be imported.`
      });
    }

    setPreviewRunners(runners);
    setValidationErrors(errors);
    setCurrentStep('preview');
  };

  const handleImport = async () => {
    setCurrentStep('importing');
    setImportProgress(0);

    // Simulate progress for better UX
    const progressSteps = [20, 40, 60, 80, 100];
    for (let i = 0; i < progressSteps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setImportProgress(progressSteps[i]);
    }

    // Actually import the data
    setRunners(previewRunners);
    
    // Close modal after brief delay
    setTimeout(() => {
      handleClose();
    }, 500);
  };

  // Auto-suggest column mapping when headers change
  React.useEffect(() => {
    if (headers.length > 0) {
      setColumnMapping(suggestColumnMapping(headers));
    }
  }, [headers]);

  const formatPace = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-xl md:max-w-3xl max-h-[85vh] overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base sm:text-lg">
            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            Import Runners from Spreadsheet
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file, map columns to fields, preview the data, and import 12 runners.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col max-h-[70vh] sm:h-[calc(85vh-120px)]">
          {/* Progress Steps */}
          <div className="flex justify-center mb-4">
            <div className="flex items-center flex-wrap justify-center gap-3 sm:gap-4">
              {['Upload', 'Mapping', 'Preview', 'Import'].map((step, index) => {
                const stepStates = ['upload', 'mapping', 'preview', 'importing'];
                const currentIndex = stepStates.indexOf(currentStep);
                const isCompleted = index < currentIndex;
                const isActive = index === currentIndex;
                
                return (
                  <div key={step} className="flex items-center">
                    <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 ${
                      isCompleted 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : isActive 
                          ? 'bg-blue-500 border-blue-500 text-white' 
                          : 'border-gray-300 text-gray-400'
                    }`}>
                      {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className={`ml-2 text-xs sm:text-sm font-medium ${
                      isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                    }`}>
                      {step}
                    </span>
                    {index < 3 && <div className="hidden sm:block w-8 h-px bg-gray-300 mx-4" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto">
            {currentStep === 'upload' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Select File
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-32 border-2 border-dashed border-gray-300 hover:border-blue-400"
                        variant="outline"
                        disabled={isProcessing}
                      >
                        <div className="text-center">
                          {isProcessing ? (
                            <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                          ) : (
                            <Upload className="h-8 w-8 mx-auto mb-2" />
                          )}
                          <div className="text-lg font-semibold">
                            {isProcessing ? 'Processing...' : 'Choose File'}
                          </div>
                          <div className="text-sm text-gray-500">
                            Excel (.xlsx, .xls) or CSV files supported
                          </div>
                        </div>
                      </Button>

                      {file && (
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                            <span className="font-medium">{file.name}</span>
                            <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {validationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <strong>File Import Error:</strong>
                          {validationErrors.map((error, index) => (
                            <div key={index} className="text-sm">
                              {error.error}
                            </div>
                          ))}
                        </div>
                        <Button 
                          onClick={() => {
                            setValidationErrors([]);
                            setFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="mt-2"
                        >
                          Try Another File
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Expected Format:</strong> Your spreadsheet should contain columns for runner names, 
                    pace (in MM:SS format), and optionally van assignments (1 or 2).
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {currentStep === 'mapping' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Map Columns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Runner Name <span className="text-red-500">*</span>
                          </Label>
                          <Select 
                            value={columnMapping.name || ''} 
                            onValueChange={(value) => setColumnMapping(prev => ({ ...prev, name: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              {headers.map(header => (
                                <SelectItem key={header} value={header}>{header}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Pace (optional)</Label>
                          <Select 
                            value={columnMapping.pace || ''} 
                            onValueChange={(value) => setColumnMapping(prev => ({ ...prev, pace: value || undefined }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__NONE__">None (use default 7:00)</SelectItem>
                              {headers.map(header => (
                                <SelectItem key={header} value={header}>{header}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Van Assignment (optional)</Label>
                          <Select 
                            value={columnMapping.van || ''} 
                            onValueChange={(value) => setColumnMapping(prev => ({ ...prev, van: value || undefined }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__NONE__">None (auto-assign)</SelectItem>
                              {headers.map(header => (
                                <SelectItem key={header} value={header}>{header}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setCurrentStep('upload')}>
                          Back
                        </Button>
                        <Button onClick={handleMappingComplete} disabled={!columnMapping.name}>
                          Preview Data
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Data Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle>Data Sample</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-40">
                      <div className="text-xs">
                        <div className="grid grid-cols-1 gap-1">
                          {parsedData.slice(0, 5).map((row, index) => (
                            <div key={index} className="p-2 bg-gray-50 rounded">
                              <div className="font-mono text-gray-600">
                                Row {index + 1}: {JSON.stringify(row)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}

            {currentStep === 'preview' && (
              <div className="space-y-6">
                {validationErrors.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        {validationErrors.some(e => e.row === -1) ? (
                          <div>
                            <strong>Import Notice:</strong>
                            {validationErrors
                              .filter(e => e.row === -1)
                              .map((error, index) => (
                                <div key={index} className="text-sm mt-1">
                                  {error.error}
                                </div>
                              ))
                            }
                            {validationErrors.filter(e => e.row !== -1).length > 0 && (
                              <div className="mt-2">
                                <strong>Data Issues ({validationErrors.filter(e => e.row !== -1).length} found):</strong>
                                {validationErrors
                                  .filter(e => e.row !== -1)
                                  .slice(0, 3)
                                  .map((error, index) => (
                                    <div key={index} className="text-sm">
                                      Row {error.row}: {error.error}
                                    </div>
                                  ))
                                }
                                {validationErrors.filter(e => e.row !== -1).length > 3 && (
                                  <div className="text-sm">...and {validationErrors.filter(e => e.row !== -1).length - 3} more</div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <strong>{validationErrors.length} data issues found:</strong>
                            {validationErrors.slice(0, 3).map((error, index) => (
                              <div key={index} className="text-sm">
                                Row {error.row}: {error.error}
                              </div>
                            ))}
                            {validationErrors.length > 3 && (
                              <div className="text-sm">...and {validationErrors.length - 3} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Preview Import ({previewRunners.length} runners)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-60">
                      <div className="space-y-2">
                        {previewRunners.map((runner) => (
                          <div key={runner.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-3">
                              <Badge variant={runner.van === 1 ? "default" : "secondary"}>
                                Van {runner.van}
                              </Badge>
                              <span className="font-medium">{runner.name}</span>
                            </div>
                            <div className="text-sm text-gray-600 font-mono">
                              {formatPace(runner.pace)}/mile
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setCurrentStep('mapping')}>
                    Back
                  </Button>
                  <Button onClick={handleImport} className="bg-green-600 hover:bg-green-700">
                    Import Runners
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'importing' && (
              <div className="space-y-6 text-center">
                <div className="space-y-4">
                  <RefreshCw className="h-12 w-12 mx-auto text-blue-600 animate-spin" />
                  <div>
                    <h3 className="text-lg font-semibold">Importing Runners...</h3>
                    <p className="text-gray-600">Please wait while we process your data</p>
                  </div>
                  <div className="space-y-2">
                    <Progress value={importProgress} className="w-full" />
                    <p className="text-sm text-gray-500">{importProgress}% complete</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SpreadsheetImport;
