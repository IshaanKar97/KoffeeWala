### KoffeeWala Phase 2: 



#### Agenda: Making the application easier to use with better UX for mobile and Tablet



###### **Phase 2.1: The Brew Calculator**



The Brew Calculator modes will be divided into instrument \& Brewing Method



&#x20; - Instrument:

&#x20;     1. v60

&#x20;     2. Filter coffee

&#x20;     3. Mokka-Pot ( Put in debt)



&#x20; - Brewing Method:

&#x20;     1. v60:

&#x20;         - 1-pour

&#x20;         - 3-pour

&#x20;         - 10-Pour Method: User use a 10-pour method to brew coffee. It remains similar to default v60 brew with just change in the no of pours after bloom. In 10-pour, the no. of pours after bloom is 10nwith equal amount of water

&#x20;         - Advanced Mode: User can tinker with all the following parameters: bloom amount, no. of pours, Total amount of water (ignores the multiplying factor)



&#x20;     Additional Changes: 

&#x20;         1. All of these brewing method for v60 can be switched from without ice to with ice (By default with ice toggle is off)

&#x20;         2. The bloom will be fixed to 2\*coffee amount in all the brewing methods except Advanced Mode.



&#x20;       2. Filter Coffee

&#x20;           - With Milk

&#x20;           - With Water







###### **Phase 2.2: The Recipe Book**



The recipe book will be optimized for tab and mobile view.



Major Changes:

&#x20; 1. Each instrument will, have a separate database in notion.

&#x20; 2. The recipe book in application will be a combined view of all the instruments.

&#x20; 3. Introduction of filters (as chips) to filter with instrument, date, with/without ice, ratings etc. For a particular user, the filter preference is always remembered.

&#x20; 4. The name of each recipe will be combination of current date \& Time.

&#x20; 5. The actual date column will be hidden.

&#x20; 6. Editing directly in the recipe book is not allowed. User has to select a recipe \& In the expanded view, there will be an edit option

&#x20; 6. The recipe-book will have the following view for each screen type:

&#x20;    

&#x20;    - Tab: The recipe-book will appear as table (with flex ability). the following column will be shown by default (Rest of the available columns will be hidden)

&#x20;         - Name (combination of Date and time)

&#x20;         - Coffee Amount

&#x20;         - Ratio factor

&#x20;         - Ice Amount

&#x20;         - Bloom

&#x20;         - 1st pour water (for filter coffee \& Mokka pot 1st pour becomes the total water \& time) 

&#x20;         - 1st pour time

&#x20;         - 2nd pour Water

&#x20;         - 2nd pour time

&#x20;         - 3rd pour water

&#x20;         - 3rd pour time

&#x20;       Expanding behaviour: when a recipe is selected, the table shrinks to reveal a split view on the right with entire details of the which looks similar to the brew calculator interface with pour number, pour water \& pour time side by side. this view will have date \& time along with instrument as heading. The heading will also have 2 actions (Edit, Delete \& re-brew). This view also allows the allowed edits that a user can do. This split view will convert to a new page in the mobile view



&#x20;     - Mobile: The recipe-book will appear as cards with the following details:

&#x20;         - Name (combination of Date and time)

&#x20;         - Coffee Amount

&#x20;         - Ratio factor

&#x20;         - Ice Amount

&#x20;         - Total water

&#x20;       Expanding behaviour: when a recipe is selected, a new page opens to show entire details of the recipe which looks similar to the brew calculator interface with pour number, pour water \& pour time side by side. this view will have date \& time along with instrument as heading. The heading will also have 2 actions (Delete entry \& re-brew). This view also allows the allowed edits that a user can do. The split view in the tab screen will convert to a new page in this mobile view



















