package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/ollama/ollama/kuhul"
	"github.com/spf13/cobra"
)

var kuhulCmd = &cobra.Command{
	Use:     "kuhul [file.khl]",
	Short:   "Execute K'UHUL programs",
	Long:    `Execute K'UHUL (Kernel Hyper Universal Language) programs.`,
	Example: `  ollama kuhul program.khl
  ollama kuhul -e "⟁Wo⟁ x = 10"
  ollama kuhul --repl`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		// Get flags
		evalExpr, _ := cmd.Flags().GetString("eval")
		replMode, _ := cmd.Flags().GetBool("repl")
		tokenize, _ := cmd.Flags().GetBool("tokenize")
		parseOnly, _ := cmd.Flags().GetBool("parse")
		jsonOutput, _ := cmd.Flags().GetBool("json")

		// REPL mode
		if replMode {
			return runKuhulREPL()
		}

		// Eval expression
		if evalExpr != "" {
			return evalKuhulExpr(evalExpr, tokenize, parseOnly, jsonOutput)
		}

		// Execute file
		if len(args) > 0 {
			return execKuhulFile(args[0], tokenize, parseOnly, jsonOutput)
		}

		// No arguments, show help
		return cmd.Help()
	},
}

func init() {
	kuhulCmd.Flags().StringP("eval", "e", "", "Evaluate a K'UHUL expression")
	kuhulCmd.Flags().Bool("repl", false, "Start interactive REPL")
	kuhulCmd.Flags().Bool("tokenize", false, "Only tokenize (don't parse or execute)")
	kuhulCmd.Flags().Bool("parse", false, "Only parse (don't execute)")
	kuhulCmd.Flags().Bool("json", false, "Output as JSON")
}

func execKuhulFile(filename string, tokenize, parseOnly, jsonOutput bool) error {
	// Read file
	content, err := os.ReadFile(filename)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	source := string(content)

	if tokenize {
		return tokenizeKuhul(source, jsonOutput)
	}

	if parseOnly {
		return parseKuhul(source, jsonOutput)
	}

	// Execute
	result, err := kuhul.Run(source)
	if err != nil {
		return fmt.Errorf("execution error: %w", err)
	}

	return outputResult(result, jsonOutput)
}

func evalKuhulExpr(expr string, tokenize, parseOnly, jsonOutput bool) error {
	if tokenize {
		return tokenizeKuhul(expr, jsonOutput)
	}

	if parseOnly {
		return parseKuhul(expr, jsonOutput)
	}

	result, err := kuhul.Eval(expr)
	if err != nil {
		return fmt.Errorf("evaluation error: %w", err)
	}

	return outputResult(result, jsonOutput)
}

func tokenizeKuhul(source string, jsonOutput bool) error {
	tokens := kuhul.Tokenize(source)

	if jsonOutput {
		return outputJSON(tokens)
	}

	for _, tok := range tokens {
		fmt.Printf("%s\n", tok.String())
	}
	return nil
}

func parseKuhul(source string, jsonOutput bool) error {
	program, errors := kuhul.Parse(source)
	if len(errors) > 0 {
		for _, err := range errors {
			fmt.Fprintf(os.Stderr, "Parse error: %s\n", err)
		}
		return fmt.Errorf("parsing failed with %d errors", len(errors))
	}

	if jsonOutput {
		return outputJSON(program)
	}

	fmt.Println(program.String())
	return nil
}

func runKuhulREPL() error {
	fmt.Println("K'UHUL REPL v" + kuhul.Version)
	fmt.Println("The law: ASX = XCFE = XJSON = KUHUL = AST = ATOMIC_BLOCK")
	fmt.Println("Type 'exit' to quit, 'help' for commands")
	fmt.Println()

	interp := kuhul.NewInterpreter()
	scanner := bufio.NewScanner(os.Stdin)

	for {
		fmt.Print("kuhul> ")
		if !scanner.Scan() {
			break
		}

		line := strings.TrimSpace(scanner.Text())

		if line == "" {
			continue
		}

		if line == "exit" || line == "quit" {
			fmt.Println("Goodbye!")
			break
		}

		if line == "help" {
			printREPLHelp()
			continue
		}

		if line == "state" {
			state := interp.GetState()
			outputJSON(state.GetState())
			continue
		}

		if strings.HasPrefix(line, "load ") {
			filename := strings.TrimPrefix(line, "load ")
			content, err := os.ReadFile(filename)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				continue
			}
			_, errors := interp.Load(string(content))
			if len(errors) > 0 {
				for _, e := range errors {
					fmt.Fprintf(os.Stderr, "Parse error: %s\n", e)
				}
				continue
			}
			fmt.Println("Loaded:", filename)
			continue
		}

		if line == "run" {
			result, err := interp.Run()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				continue
			}
			outputJSON(result)
			continue
		}

		if strings.HasPrefix(line, "dispatch ") {
			handlerName := strings.TrimPrefix(line, "dispatch ")
			result, err := interp.Dispatch(handlerName, nil)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				continue
			}
			outputJSON(result)
			continue
		}

		if strings.HasPrefix(line, "fp ") {
			data := strings.TrimPrefix(line, "fp ")
			fp := kuhul.Fingerprint(data)
			fmt.Println(fp)
			continue
		}

		// Evaluate expression
		result, err := interp.Eval(line)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			continue
		}

		if result != nil {
			outputJSON(result)
		}
	}

	return nil
}

func printREPLHelp() {
	fmt.Println(`K'UHUL REPL Commands:
  help              Show this help
  exit, quit        Exit the REPL
  state             Show runtime state
  load <file>       Load a K'UHUL file
  run               Run the loaded program
  dispatch <name>   Dispatch to a handler
  fp <data>         Generate SCXQ2 fingerprint

K'UHUL Syntax:
  ⟁Pop⟁ name {...}  Declaration (manifest, config)
  ⟁Wo⟁ name = val   Assignment (variables)
  ⟁Sek⟁ vector      Control flow (if, loop)
  ⟁Xul⟁ name        Block definition start
  ⟁Ch'en⟁ {...}     Return/emit from block
  ⟁Yax⟁ name        Reference a value
  ⟁K'ayab⟁ i from   Loop construct
  ⟁Kumk'u⟁          End loop

Examples:
  ⟁Wo⟁ x = 10
  ⟁Wo⟁ y = [1, 2, 3]
  ⟁Wo⟁ data = {"name": "test"}
`)
}

func outputResult(result interface{}, jsonOutput bool) error {
	if jsonOutput {
		return outputJSON(result)
	}

	switch v := result.(type) {
	case string:
		fmt.Println(v)
	case map[string]interface{}, []interface{}:
		return outputJSON(v)
	default:
		fmt.Printf("%v\n", v)
	}
	return nil
}

func outputJSON(v interface{}) error {
	bytes, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(bytes))
	return nil
}

// GetKuhulCmd returns the kuhul command for registration
func GetKuhulCmd() *cobra.Command {
	return kuhulCmd
}
